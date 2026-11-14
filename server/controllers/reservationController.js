const Reservation = require('../models/Reservation');
const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const User = require('../models/User');
const Setting = require('../models/Setting');
const Notification = require('../models/Notification');
const { logAudit } = require('../utils/auditLogger');

// @desc Place a reservation
// @route POST /api/v1/reservations
exports.createReservation = async (req, res, next) => {
  try {
    const { bookId, studentId } = req.body;
    const targetStudentId = req.user.role === 'student' ? req.user._id : (studentId || req.user._id);

    const student = await User.findById(targetStudentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Student account not found.'
      });
    }

    const book = await Book.findById(bookId);
    if (!book || book.isDeleted) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Book not found.'
      });
    }

    // Rule: Reservation only allowed when NO copy is currently available (Section F)
    if (book.availableCopies > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Book "${book.title}" currently has ${book.availableCopies} available copy/copies. Please issue the book directly instead of reserving.`
      });
    }

    // Check existing active reservation for this book by this student
    const existing = await Reservation.findOne({
      bookId: book._id,
      studentId: student._id,
      status: { $in: ['pending', 'ready_for_pickup'] }
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'You already have an active reservation for this title.'
      });
    }

    const settings = await Setting.findOne() || { maxReservations: 3 };
    const userActiveResCount = await Reservation.countDocuments({
      studentId: student._id,
      status: { $in: ['pending', 'ready_for_pickup'] }
    });

    if (userActiveResCount >= 3) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Maximum limit of 3 active reservations reached.'
      });
    }

    // Determine queue position
    const currentQueueCount = await Reservation.countDocuments({
      bookId: book._id,
      status: 'pending'
    });
    const queuePosition = currentQueueCount + 1;

    const reservation = await Reservation.create({
      bookId: book._id,
      studentId: student._id,
      status: 'pending',
      queuePosition
    });

    await Notification.create({
      userId: student._id,
      type: 'reservation_ready',
      message: `Reservation placed for "${book.title}". You are #${queuePosition} in the queue.`
    });

    await logAudit(req, 'CREATE_RESERVATION', 'Reservation', reservation._id, {
      book: book.title,
      student: student.name,
      queuePosition
    });

    return res.status(201).json({
      success: true,
      data: reservation,
      message: `Reservation confirmed. You are #${queuePosition} in line.`
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get all reservations (Librarian/Admin)
// @route GET /api/v1/reservations
exports.getReservations = async (req, res, next) => {
  try {
    const { status, bookId, studentId, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (bookId) query.bookId = bookId;
    if (studentId) query.studentId = studentId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Reservation.countDocuments(query);
    const reservations = await Reservation.find(query)
      .populate('bookId', 'title isbn coverUrl')
      .populate('studentId', 'name studentId email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: {
        reservations,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      },
      message: 'Reservations retrieved'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get current student's reservations
// @route GET /api/v1/reservations/me
exports.getMyReservations = async (req, res, next) => {
  try {
    const reservations = await Reservation.find({ studentId: req.user._id })
      .populate('bookId', 'title isbn coverUrl')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: reservations,
      message: 'My reservations retrieved'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update reservation (cancel, fulfill, extend)
// @route PATCH /api/v1/reservations/:id
exports.updateReservation = async (req, res, next) => {
  try {
    const { action, extendDays = 2 } = req.body;
    const reservation = await Reservation.findById(req.params.id).populate('bookId studentId');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Reservation not found.'
      });
    }

    if (action === 'cancel') {
      // Students can cancel their own; librarians/admins can cancel any
      if (req.user.role === 'student' && reservation.studentId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          data: null,
          message: 'Access denied.'
        });
      }

      reservation.status = 'cancelled';
      await reservation.save();

      // Re-index remaining queue positions for this book
      const remaining = await Reservation.find({ bookId: reservation.bookId._id, status: 'pending' }).sort({ queuePosition: 1 });
      for (let i = 0; i < remaining.length; i++) {
        remaining[i].queuePosition = i + 1;
        await remaining[i].save();
      }

      await logAudit(req, 'CANCEL_RESERVATION', 'Reservation', reservation._id);

      return res.status(200).json({
        success: true,
        data: reservation,
        message: 'Reservation cancelled successfully.'
      });
    }

    if (action === 'extend') {
      if (req.user.role === 'student') {
        return res.status(403).json({
          success: false,
          data: null,
          message: 'Only library staff can extend pickup holds.'
        });
      }

      if (reservation.status !== 'ready_for_pickup') {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Only reservations in "ready for pickup" status can be extended.'
        });
      }

      const currentExpires = reservation.expiresAt ? new Date(reservation.expiresAt) : new Date();
      currentExpires.setDate(currentExpires.getDate() + parseInt(extendDays));
      reservation.expiresAt = currentExpires;
      await reservation.save();

      await Notification.create({
        userId: reservation.studentId._id,
        type: 'reservation_ready',
        message: `Your pickup window for "${reservation.bookId.title}" has been extended to ${currentExpires.toLocaleDateString()}.`
      });

      await logAudit(req, 'EXTEND_RESERVATION', 'Reservation', reservation._id, { newExpiresAt: currentExpires });

      return res.status(200).json({
        success: true,
        data: reservation,
        message: `Pickup window extended to ${currentExpires.toLocaleDateString()}.`
      });
    }

    return res.status(400).json({
      success: false,
      data: null,
      message: 'Invalid action. Supported actions: cancel, extend'
    });
  } catch (error) {
    next(error);
  }
};
