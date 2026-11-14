const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },
    copyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookCopy',
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    issueDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    returnDate: {
      type: Date
    },
    returnedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    renewalCount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'returned', 'overdue', 'lost'],
      default: 'active'
    },
    conditionOnReturn: {
      type: String,
      enum: ['good', 'damaged', 'lost', 'fair', 'poor'],
      default: 'good'
    }
  },
  {
    timestamps: true
  }
);

loanSchema.index({ studentId: 1, status: 1 });
loanSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('Loan', loanSchema);
