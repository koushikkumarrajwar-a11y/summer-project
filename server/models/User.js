const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['admin', 'librarian', 'student'],
      default: 'student',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Please provide full name'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Please provide email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    passwordHash: {
      type: String,
      required: [true, 'Please provide password'],
      minlength: 8
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      trim: true
    },
    year: {
      type: String,
      trim: true
    },
    photoUrl: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'graduated'],
      default: 'pending'
    },
    failedLoginCount: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date
    },
    resetTokenHash: {
      type: String
    },
    resetTokenExpiry: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.failedLoginCount = 1;
    this.lockUntil = undefined;
    return await this.save();
  }

  this.failedLoginCount += 1;
  // Account lockout for 15 minutes after 5 consecutive failed attempts
  if (this.failedLoginCount >= 5 && !this.isLocked()) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  return await this.save();
};

userSchema.methods.resetLoginAttempts = async function () {
  this.failedLoginCount = 0;
  this.lockUntil = undefined;
  return await this.save();
};

module.exports = mongoose.model('User', userSchema);
