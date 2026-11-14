const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    libraryName: {
      type: String,
      default: 'Athenaeum Central Library'
    },
    libraryLogo: {
      type: String,
      default: ''
    },
    contactEmail: {
      type: String,
      default: 'support@library.edu'
    },
    contactPhone: {
      type: String,
      default: '+1 (555) 234-5678'
    },
    address: {
      type: String,
      default: '100 University Avenue, Academic Square'
    },
    currency: {
      type: String,
      default: '$'
    },
    loanPeriodDays: {
      type: Number,
      default: 14
    },
    maxBooksPerStudent: {
      type: Number,
      default: 3
    },
    renewalLimit: {
      type: Number,
      default: 2
    },
    reservationPickupDays: {
      type: Number,
      default: 3
    },
    finePerDay: {
      type: Number,
      default: 5
    },
    maxFineCap: {
      type: Number,
      default: 50
    },
    fineBlockThreshold: {
      type: Number,
      default: 20
    },
    waiverApprovalThreshold: {
      type: Number,
      default: 15
    },
    registrationMode: {
      type: String,
      enum: ['auto', 'approval'],
      default: 'approval'
    },
    sessionTimeoutMinutes: {
      type: Number,
      default: 30
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Setting', settingSchema);
