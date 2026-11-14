const mongoose = require('mongoose');

const bookCopySchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },
    accessionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['available', 'issued', 'on_hold', 'lost', 'damaged'],
      default: 'available',
      required: true
    },
    condition: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor', 'damaged', 'lost'],
      default: 'good'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('BookCopy', bookCopySchema);
