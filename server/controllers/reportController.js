const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const AuditLog = require('../models/AuditLog');
const Category = require('../models/Category');

// @desc Role-aware dashboard statistics (Section B & 7)
// @route GET /api/v1/dashboard/stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const user = req.user;
    const now = new Date();

    if (user.role === 'admin') {
      const [
        totalBooks,
        totalCopies,
        issuedCopies,
        totalStudents,
        totalLibrarians,
        overdueLoans,
        allFines,
        categories,
        recentAudits,
        loansLast30Days
      ] = await Promise.all([
        Book.countDocuments({ isDeleted: false }),
        BookCopy.countDocuments(),
        BookCopy.countDocuments({ status: 'issued' }),
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'librarian' }),
        Loan.countDocuments({ status: { $in: ['active', 'overdue'] }, dueDate: { $lt: now } }),
        Fine.find(),
        Category.find().select('name'),
        AuditLog.find().sort({ createdAt: -1 }).limit(10),
        Loan.find({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
      ]);

      const availableCopies = totalCopies - issuedCopies;
      const totalCollectedFines = allFines.reduce((sum, f) => sum + f.amountPaid, 0);
      const totalOutstandingFines = allFines.reduce((sum, f) => sum + (f.amount - f.amountPaid - f.waivedAmount), 0);

      // Books by category breakdown for donut chart
      const categoryCounts = await Book.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
        { $unwind: '$cat' },
        { $project: { name: '$cat.name', count: 1 } }
      ]);

      // Issues vs returns timeline for chart
      const circulationTrends = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(5, 10); // MM-DD
        const startOfDay = new Date(d.setHours(0, 0, 0, 0));
        const endOfDay = new Date(d.setHours(23, 59, 59, 999));

        const issuesCount = await Loan.countDocuments({ issueDate: { $gte: startOfDay, $lte: endOfDay } });
        const returnsCount = await Loan.countDocuments({ returnDate: { $gte: startOfDay, $lte: endOfDay } });

        circulationTrends.push({ date: dateStr, issues: issuesCount, returns: returnsCount });
      }

      return res.status(200).json({
        success: true,
        data: {
          role: 'admin',
          summary: {
            totalBooks,
            totalCopies,
            availableCopies,
            issuedCopies,
            totalStudents,
            totalLibrarians,
            overdueLoans,
            totalCollectedFines,
            totalOutstandingFines
          },
          categoryCounts,
          circulationTrends,
          recentActivities: recentAudits
        },
        message: 'Admin dashboard statistics retrieved'
      });
    }

    if (user.role === 'librarian') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [
        totalBooks,
        availableCopies,
        issuedCopies,
        totalStudents,
        overdueLoans,
        pendingReservations,
        todayDueLoans,
        allFinesToday,
        recentActivities
      ] = await Promise.all([
        Book.countDocuments({ isDeleted: false }),
        BookCopy.countDocuments({ status: 'available' }),
        BookCopy.countDocuments({ status: 'issued' }),
        User.countDocuments({ role: 'student' }),
        Loan.find({ status: { $in: ['active', 'overdue'] }, dueDate: { $lt: now } })
          .populate('bookId', 'title')
          .populate('studentId', 'name email studentId phone')
          .populate('copyId', 'accessionNumber')
          .limit(10),
        Reservation.countDocuments({ status: 'pending' }),
        Loan.find({
          status: 'active',
          dueDate: {
            $gte: startOfToday,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        })
          .populate('bookId', 'title')
          .populate('studentId', 'name studentId')
          .populate('copyId', 'accessionNumber'),
        Fine.find({ 'payments.date': { $gte: startOfToday } }),
        AuditLog.find({ action: { $in: ['ISSUE_BOOK', 'RETURN_BOOK', 'RENEW_LOAN', 'RECORD_FINE_PAYMENT'] } })
          .sort({ createdAt: -1 })
          .limit(8)
      ]);

      let finesCollectedToday = 0;
      allFinesToday.forEach((f) => {
        f.payments.forEach((p) => {
          if (p.date >= startOfToday) {
            finesCollectedToday += p.amount;
          }
        });
      });

      return res.status(200).json({
        success: true,
        data: {
          role: 'librarian',
          summary: {
            totalBooks,
            availableCopies,
            issuedCopies,
            totalStudents,
            overdueCount: overdueLoans.length,
            finesCollectedToday,
            pendingReservations
          },
          todayDueList: todayDueLoans,
          overdueList: overdueLoans,
          recentActivities
        },
        message: 'Librarian dashboard statistics retrieved'
      });
    }

    // Student Dashboard (Section B3)
    if (user.role === 'student') {
      const [myLoans, myFines, myReservations, recentBooks] = await Promise.all([
        Loan.find({ studentId: user._id, status: { $in: ['active', 'overdue'] } })
          .populate('bookId', 'title isbn coverUrl categoryId')
          .populate('copyId', 'accessionNumber')
          .sort({ dueDate: 1 }),
        Fine.find({ studentId: user._id, status: { $in: ['unpaid', 'partial'] } }),
        Reservation.find({ studentId: user._id, status: { $in: ['pending', 'ready_for_pickup'] } })
          .populate('bookId', 'title coverUrl')
          .sort({ createdAt: -1 }),
        Book.find({ isDeleted: false })
          .populate('categoryId', 'name')
          .sort({ createdAt: -1 })
          .limit(6)
      ]);

      const outstandingFines = myFines.reduce(
        (sum, f) => sum + (f.amount - f.amountPaid - f.waivedAmount),
        0
      );

      // Color coding days remaining: green, amber (<=3 days), red (overdue)
      const enhancedLoans = myLoans.map((l) => {
        const due = new Date(l.dueDate);
        const diffMs = due - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        let urgency = 'green';
        if (diffDays < 0) urgency = 'red';
        else if (diffDays <= 3) urgency = 'amber';

        return {
          ...l.toObject(),
          daysRemaining: diffDays,
          urgency
        };
      });

      const nextDueDate = enhancedLoans.length > 0 ? enhancedLoans[0].dueDate : null;

      // Borrowing history for recommendations
      const pastLoans = await Loan.find({ studentId: user._id }).populate('bookId');
      const pastCategoryIds = pastLoans.filter((pl) => pl.bookId).map((pl) => pl.bookId.categoryId);

      let recommendations = [];
      if (pastCategoryIds.length > 0) {
        recommendations = await Book.find({
          categoryId: { $in: pastCategoryIds },
          isDeleted: false
        })
          .populate('categoryId', 'name')
          .limit(4);
      } else {
        recommendations = recentBooks.slice(0, 4);
      }

      return res.status(200).json({
        success: true,
        data: {
          role: 'student',
          summary: {
            booksIssued: enhancedLoans.length,
            nextDueDate,
            outstandingFines,
            activeReservations: myReservations.length
          },
          issuedBooks: enhancedLoans,
          activeReservations: myReservations,
          recommendations,
          recentBooks
        },
        message: 'Student dashboard statistics retrieved'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc Detailed system reports (Section I)
// @route GET /api/v1/reports/:type
exports.getReport = async (req, res, next) => {
  try {
    const { type } = req.params; // circulation, inventory, fines, reservations

    if (type === 'circulation') {
      const mostBorrowed = await Loan.aggregate([
        { $group: { _id: '$bookId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
        { $unwind: '$book' },
        { $project: { title: '$book.title', isbn: '$book.isbn', borrowCount: '$count' } }
      ]);

      const mostActiveStudents = await Loan.aggregate([
        { $group: { _id: '$studentId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' } },
        { $unwind: '$student' },
        { $project: { name: '$student.name', studentId: '$student.studentId', totalLoans: '$count' } }
      ]);

      return res.status(200).json({
        success: true,
        data: { mostBorrowed, mostActiveStudents },
        message: 'Circulation report generated'
      });
    }

    if (type === 'inventory') {
      const copyStatusBreakdown = await BookCopy.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      const categoryDistribution = await Book.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$categoryId', totalTitles: { $sum: 1 }, totalCopies: { $sum: '$totalCopies' } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
        { $unwind: '$cat' },
        { $project: { categoryName: '$cat.name', totalTitles: 1, totalCopies: 1 } }
      ]);

      return res.status(200).json({
        success: true,
        data: { copyStatusBreakdown, categoryDistribution },
        message: 'Inventory report generated'
      });
    }

    if (type === 'fines') {
      const fines = await Fine.find();
      const totalAccrued = fines.reduce((s, f) => s + f.amount, 0);
      const totalCollected = fines.reduce((s, f) => s + f.amountPaid, 0);
      const totalWaived = fines.reduce((s, f) => s + f.waivedAmount, 0);
      const totalOutstanding = totalAccrued - totalCollected - totalWaived;

      return res.status(200).json({
        success: true,
        data: { totalAccrued, totalCollected, totalWaived, totalOutstanding, count: fines.length },
        message: 'Fines report generated'
      });
    }

    return res.status(400).json({
      success: false,
      data: null,
      message: 'Unknown report type. Available types: circulation, inventory, fines'
    });
  } catch (error) {
    next(error);
  }
};
