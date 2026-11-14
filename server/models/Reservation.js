const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'ready_for_pickup', 'fulfilled', 'cancelled', 'expired'],
      default: 'pending'
    },
    queuePosition: {
      type: Number,
      default: 1
    },
    notifiedAt: {
      type: Date
    },
    expiresAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

reservationSchema.index({ bookId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
