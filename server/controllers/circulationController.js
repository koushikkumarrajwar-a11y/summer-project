const Loan = require('../models/Loan');
const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const User = require('../models/User');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const Setting = require('../models/Setting');
const Notification = require('../models/Notification');
const { calculateOverdueFine } = require('../services/fineService');
const { logAudit } = require('../utils/auditLogger');

// @desc Issue a book
// @route POST /api/v1/loans
exports.issueBook = async (req, res, next) => {
  try {
    const { studentId, accessionNumber, copyId } = req.body;
    const settings = await Setting.findOne() || {
      loanPeriodDays: 14,
      maxBooksPerStudent: 3,
      fineBlockThreshold: 20
    };

    // 1. Validate student
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Valid student account not found.'
      });
    }

    if (student.status !== 'active') {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Student account is not active (current status: ${student.status}). Cannot issue book.`
      });
    }

    // 2. Check student borrowing limit
    const activeLoansCount = await Loan.countDocuments({
      studentId: student._id,
      status: { $in: ['active', 'overdue'] }
    });

    if (activeLoansCount >= (settings.maxBooksPerStudent || 3)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Borrowing limit reached: Student already has ${activeLoansCount} book(s) issued (maximum allowed: ${settings.maxBooksPerStudent}).`
      });
    }

    // 3. Check unpaid fines threshold
    const unpaidFines = await Fine.find({
      studentId: student._id,
      status: { $in: ['unpaid', 'partial'] }
    });
    const totalUnpaid = unpaidFines.reduce((sum, f) => sum + (f.amount - f.amountPaid - f.waivedAmount), 0);
    if (totalUnpaid > (settings.fineBlockThreshold || 20)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Borrowing blocked: Student has ${settings.currency || '$'}${totalUnpaid} in unpaid fines (threshold is ${settings.currency || '$'}${settings.fineBlockThreshold}).`
      });
    }

    // 4. Find copy
    let copy = null;
    if (copyId) {
      copy = await BookCopy.findById(copyId).populate('bookId');
    } else if (accessionNumber) {
      copy = await BookCopy.findOne({ accessionNumber: accessionNumber.trim() }).populate('bookId');
    }

    if (!copy) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Book copy not found with given accession number or ID.'
      });
    }

    if (copy.status !== 'available' && copy.status !== 'on_hold') {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Copy ${copy.accessionNumber} is not available (current status: ${copy.status}).`
      });
    }

    // If copy is on_hold, verify if it is reserved for this student
    if (copy.status === 'on_hold') {
      const activeHold = await Reservation.findOne({
        bookId: copy.bookId._id,
        studentId: student._id,
        status: 'ready_for_pickup'
      });
      if (!activeHold) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'This copy is currently held for another student reservation.'
        });
      }
      activeHold.status = 'fulfilled';
      await activeHold.save();
    }

    // 5. Check if student already holds another copy of this same title (Section E1)
    const existingTitleLoan = await Loan.findOne({
      studentId: student._id,
      bookId: copy.bookId._id,
      status: { $in: ['active', 'overdue'] }
    });
    if (existingTitleLoan) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Student already has an active loan for title "${copy.bookId.title}".`
      });
    }

    // Calculate dates
    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (settings.loanPeriodDays || 14));

    const loan = await Loan.create({
      bookId: copy.bookId._id,
      copyId: copy._id,
      studentId: student._id,
      issuedBy: req.user._id,
      issueDate,
      dueDate,
      status: 'active'
    });

    copy.status = 'issued';
    await copy.save();

    await Book.findByIdAndUpdate(copy.bookId._id, {
      $inc: { availableCopies: -1 }
    });

    // In-app notification
    await Notification.create({
      userId: student._id,
      type: 'issue',
      message: `"${copy.bookId.title}" has been issued to you. Due date: ${dueDate.toLocaleDateString()}.`
    });

    await logAudit(req, 'ISSUE_BOOK', 'Loan', loan._id, {
      student: student.name,
      book: copy.bookId.title,
      accessionNumber: copy.accessionNumber,
      dueDate
    });

    const populatedLoan = await Loan.findById(loan._id)
      .populate('bookId', 'title isbn coverUrl')
      .populate('copyId', 'accessionNumber')
      .populate('studentId', 'name studentId email')
      .populate('issuedBy', 'name');

    return res.status(201).json({
      success: true,
      data: populatedLoan,
      message: 'Book issued successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Return a book
// @route POST /api/v1/loans/:id/return
exports.returnBook = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('bookId')
      .populate('copyId')
      .populate('studentId');

    if (!loan) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Loan record not found.'
      });
    }

    if (loan.status === 'returned') {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'This loan has already been marked as returned.'
      });
    }

    const { condition = 'good', damageCharge = 0, damageReason = '' } = req.body;
    const settings = await Setting.findOne() || {
      finePerDay: 5,
      maxFineCap: 50,
      reservationPickupDays: 3,
      currency: '$'
    };

    loan.returnDate = new Date();
    loan.returnedTo = req.user._id;
    loan.conditionOnReturn = condition;
    loan.status = condition === 'lost' ? 'lost' : 'returned';

    // 1. Calculate overdue fine if applicable
    const { daysOverdue, fineAmount } = await calculateOverdueFine(loan, loan.bookId.price);
    let fineRecord = null;

    if (fineAmount > 0) {
      fineRecord = await Fine.create({
        loanId: loan._id,
        studentId: loan.studentId._id,
        reason: 'overdue',
        description: `Overdue by ${daysOverdue} days for "${loan.bookId.title}"`,
        amount: fineAmount,
        status: 'unpaid'
      });
    }

    // 2. Handle Lost or Damaged condition (Section E4)
    if (condition === 'lost') {
      const lostFee = (loan.bookId.price || 20) + 10; // book price + processing fee
      await Fine.create({
        loanId: loan._id,
        studentId: loan.studentId._id,
        reason: 'lost',
        description: `Lost book charge for "${loan.bookId.title}" (${settings.currency}${loan.bookId.price} replacement + ${settings.currency}10 processing fee)`,
        amount: lostFee,
        status: 'unpaid'
      });
      loan.copyId.status = 'lost';
      loan.copyId.condition = 'lost';
      await loan.copyId.save();
    } else if (condition === 'damaged' && parseFloat(damageCharge) > 0) {
      await Fine.create({
        loanId: loan._id,
        studentId: loan.studentId._id,
        reason: 'damaged',
        description: `Damage charge for "${loan.bookId.title}": ${damageReason || 'Physical damage recorded on return'}`,
        amount: parseFloat(damageCharge),
        status: 'unpaid'
      });
      loan.copyId.status = 'damaged';
      loan.copyId.condition = 'damaged';
      await loan.copyId.save();
    } else {
      // 3. Normal return: Check if any reservation is pending for this title (Section F)
      const nextReservation = await Reservation.findOne({
        bookId: loan.bookId._id,
        status: 'pending'
      }).sort({ queuePosition: 1, createdAt: 1 }).populate('studentId');

      if (nextReservation) {
        loan.copyId.status = 'on_hold';
        loan.copyId.condition = condition;
        await loan.copyId.save();

        nextReservation.status = 'ready_for_pickup';
        nextReservation.notifiedAt = new Date();
        nextReservation.expiresAt = new Date(Date.now() + (settings.reservationPickupDays || 3) * 24 * 60 * 60 * 1000);
        await nextReservation.save();

        await Notification.create({
          userId: nextReservation.studentId._id,
          type: 'reservation_ready',
          message: `Book "${loan.bookId.title}" is ready for pickup! Hold reserved until ${nextReservation.expiresAt.toLocaleDateString()}.`
        });
      } else {
        loan.copyId.status = 'available';
        loan.copyId.condition = condition;
        await loan.copyId.save();

        await Book.findByIdAndUpdate(loan.bookId._id, {
          $inc: { availableCopies: 1 }
        });
      }
    }

    await loan.save();

    await Notification.create({
      userId: loan.studentId._id,
      type: 'return',
      message: `Return recorded for "${loan.bookId.title}". Condition: ${condition}. ${fineAmount > 0 ? `Fine assessed: ${settings.currency}${fineAmount}.` : ''}`
    });

    await logAudit(req, 'RETURN_BOOK', 'Loan', loan._id, {
      student: loan.studentId.name,
      book: loan.bookId.title,
      condition,
      daysOverdue,
      fineAmount
    });

    return res.status(200).json({
      success: true,
      data: {
        loan,
        daysOverdue,
        fineAmount,
        fineRecord
      },
      message: 'Book returned successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Renew a loan
// @route POST /api/v1/loans/:id/renew
exports.renewLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('bookId studentId');
    if (!loan) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Loan record not found.'
      });
    }

    if (loan.status !== 'active') {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Cannot renew loan with status "${loan.status}".`
      });
    }

    // Role check: If student, must be their own loan
    if (req.user.role === 'student' && loan.studentId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Cannot renew someone else’s loan.'
      });
    }

    const settings = await Setting.findOne() || {
      loanPeriodDays: 14,
      renewalLimit: 2
    };

    // Rule 1: Cannot renew if overdue (Section E3)
    if (new Date() > new Date(loan.dueDate)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Cannot renew: Loan is already overdue. Please return the book.'
      });
    }

    // Rule 2: Cannot exceed max renewals
    if (loan.renewalCount >= (settings.renewalLimit || 2)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Cannot renew: Maximum renewal limit of ${settings.renewalLimit} reached.`
      });
    }

    // Rule 3: Cannot renew if another student has reserved this book (Section E3)
    const hasReservations = await Reservation.exists({
      bookId: loan.bookId._id,
      status: { $in: ['pending', 'ready_for_pickup'] }
    });
    if (hasReservations) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Cannot renew: Another student has placed a reservation on this title.'
      });
    }

    // Renew
    loan.renewalCount += 1;
    const currentDue = new Date(loan.dueDate);
    currentDue.setDate(currentDue.getDate() + (settings.loanPeriodDays || 14));
    loan.dueDate = currentDue;
    await loan.save();

    await Notification.create({
      userId: loan.studentId._id,
      type: 'reminder',
      message: `Your loan for "${loan.bookId.title}" has been renewed. New due date: ${loan.dueDate.toLocaleDateString()}.`
    });

    await logAudit(req, 'RENEW_LOAN', 'Loan', loan._id, {
      renewalCount: loan.renewalCount,
      newDueDate: loan.dueDate
    });

    return res.status(200).json({
      success: true,
      data: loan,
      message: `Loan renewed successfully. New due date: ${loan.dueDate.toLocaleDateString()}`
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get all loans (admin & librarian)
// @route GET /api/v1/loans
exports.getLoans = async (req, res, next) => {
  try {
    const { student, status, overdue, page = 1, limit = 20 } = req.query;
    const query = {};

    if (student) query.studentId = student;
    if (status) query.status = status;
    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $in: ['active', 'overdue'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Loan.countDocuments(query);
    const loans = await Loan.find(query)
      .populate('bookId', 'title isbn coverUrl price')
      .populate('copyId', 'accessionNumber condition')
      .populate('studentId', 'name studentId email phone')
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: {
        loans,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      },
      message: 'Loans retrieved'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get current student's own loans
// @route GET /api/v1/loans/me
exports.getMyLoans = async (req, res, next) => {
  try {
    const loans = await Loan.find({ studentId: req.user._id })
      .populate('bookId', 'title isbn coverUrl authors categoryId')
      .populate('copyId', 'accessionNumber')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: loans,
      message: 'My loans retrieved'
    });
  } catch (error) {
    next(error);
  }
};
