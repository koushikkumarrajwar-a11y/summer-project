const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'other'],
      default: 'cash'
    },
    receiptNumber: {
      type: String
    }
  },
  { _id: true }
);

const fineSchema = new mongoose.Schema(
  {
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan'
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      enum: ['overdue', 'lost', 'damaged', 'manual'],
      default: 'overdue'
    },
    description: {
      type: String,
      default: ''
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    waivedAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'waived'],
      default: 'unpaid'
    },
    payments: [paymentSchema],
    waiveReason: {
      type: String
    },
    waivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

fineSchema.index({ studentId: 1, status: 1 });

module.exports = mongoose.model('Fine', fineSchema);
