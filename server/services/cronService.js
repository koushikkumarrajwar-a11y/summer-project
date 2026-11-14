const cron = require('node-cron');
const Loan = require('../models/Loan');
const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const { calculateOverdueFine } = require('./fineService');

const runNightlyTasks = async () => {
  try {
    const settings = await Setting.findOne() || { finePerDay: 5, maxFineCap: 50, reservationPickupDays: 3 };
    const now = new Date();

    // 1. Check for overdue loans and accrue fines
    const activeLoans = await Loan.find({ status: { $in: ['active', 'overdue'] } }).populate('bookId studentId');
    for (const loan of activeLoans) {
      if (loan.dueDate < now) {
        loan.status = 'overdue';
        await loan.save();

        const { daysOverdue, fineAmount } = await calculateOverdueFine(loan, loan.bookId ? loan.bookId.price : null);
        if (fineAmount > 0) {
          let fine = await Fine.findOne({ loanId: loan._id, reason: 'overdue' });
          if (!fine) {
            fine = await Fine.create({
              loanId: loan._id,
              studentId: loan.studentId._id,
              reason: 'overdue',
              description: `Overdue by ${daysOverdue} days for "${loan.bookId ? loan.bookId.title : 'Book'}"`,
              amount: fineAmount,
              status: 'unpaid'
            });
            await Notification.create({
              userId: loan.studentId._id,
              type: 'overdue',
              message: `Loan for "${loan.bookId ? loan.bookId.title : 'Book'}" is overdue by ${daysOverdue} days. Current fine: ${settings.currency || '$'}${fineAmount}.`
            });
          } else if (fine.status !== 'paid' && fine.status !== 'waived') {
            fine.amount = fineAmount;
            if (fine.amountPaid > 0 && fine.amountPaid < fineAmount) {
              fine.status = 'partial';
            } else if (fine.amountPaid >= fineAmount) {
              fine.status = 'paid';
            } else {
              fine.status = 'unpaid';
            }
            await fine.save();
          }
        }
      }
    }

    // 2. Check expiring reservations (ready_for_pickup)
    const expiredReservations = await Reservation.find({
      status: 'ready_for_pickup',
      expiresAt: { $lt: now }
    }).populate('bookId studentId');

    for (const res of expiredReservations) {
      res.status = 'expired';
      await res.save();

      await Notification.create({
        userId: res.studentId._id,
        type: 'reservation_expired',
        message: `Your reservation pickup window for "${res.bookId.title}" has expired.`
      });

      // Find next in queue
      const nextRes = await Reservation.findOne({
        bookId: res.bookId._id,
        status: 'pending'
      }).sort({ queuePosition: 1, createdAt: 1 }).populate('studentId');

      if (nextRes) {
        nextRes.status = 'ready_for_pickup';
        nextRes.notifiedAt = new Date();
        nextRes.expiresAt = new Date(Date.now() + (settings.reservationPickupDays || 3) * 24 * 60 * 60 * 1000);
        await nextRes.save();

        await Notification.create({
          userId: nextRes.studentId._id,
          type: 'reservation_ready',
          message: `Book "${res.bookId.title}" is now ready for pickup! Hold expires on ${nextRes.expiresAt.toLocaleDateString()}.`
        });
      } else {
        // No more pending reservations: make available copies status 'available'
        const holdCopy = await BookCopy.findOne({ bookId: res.bookId._id, status: 'on_hold' });
        if (holdCopy) {
          holdCopy.status = 'available';
          await holdCopy.save();
          await Book.findByIdAndUpdate(res.bookId._id, { $inc: { availableCopies: 1 } });
        }
      }
    }

    console.log(`[Cron] Nightly jobs executed successfully at ${now.toISOString()}`);
  } catch (error) {
    console.error('[Cron Error] Failed running scheduled tasks:', error.message);
  }
};

const initCron = () => {
  // Run every midnight: '0 0 * * *'
  cron.schedule('0 0 * * *', () => {
    console.log('[Cron] Triggering midnight scheduled tasks...');
    runNightlyTasks();
  });
  console.log('[Cron] Scheduled task engine initialized');
};

module.exports = { initCron, runNightlyTasks };
