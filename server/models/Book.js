const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true
    },
    authors: {
      type: [String],
      required: [true, 'At least one author is required']
    },
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true
    },
    publisher: {
      type: String,
      trim: true,
      default: ''
    },
    year: {
      type: Number
    },
    edition: {
      type: String,
      trim: true,
      default: ''
    },
    language: {
      type: String,
      trim: true,
      default: 'English'
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required']
    },
    shelfLocation: {
      type: String,
      trim: true,
      default: 'General'
    },
    pages: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      default: ''
    },
    price: {
      type: Number,
      required: [true, 'Price is required for lost-book charge'],
      default: 20
    },
    coverUrl: {
      type: String,
      default: ''
    },
    totalCopies: {
      type: Number,
      default: 1,
      min: 0
    },
    availableCopies: {
      type: Number,
      default: 1,
      min: 0
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

bookSchema.index({ title: 'text', authors: 'text', isbn: 'text' });

module.exports = mongoose.model('Book', bookSchema);
