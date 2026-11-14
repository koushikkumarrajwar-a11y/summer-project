const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const { logAudit } = require('../utils/auditLogger');

// @desc Get users (with filters & pagination)
// @route GET /api/v1/users
exports.getUsers = async (req, res, next) => {
  try {
    const { role, status, search, department, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role) {
      // Librarians can only query students
      if (req.user.role === 'librarian' && role !== 'student') {
        return res.status(403).json({
          success: false,
          data: null,
          message: 'Librarians can only access student records.'
        });
      }
      query.role = role;
    } else if (req.user.role === 'librarian') {
      query.role = 'student';
    }

    if (status) query.status = status;
    if (department) query.department = new RegExp(department, 'i');

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { studentId: regex },
        { phone: regex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-passwordHash -resetTokenHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: {
        users,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      },
      message: 'Users retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create user (Admin creates librarian or student; Librarian creates student)
// @route POST /api/v1/users
exports.createUser = async (req, res, next) => {
  try {
    const { role = 'student', name, email, studentId, phone, department, year, password, status = 'active' } = req.body;

    if (req.user.role === 'librarian' && role !== 'student') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Librarians cannot create administrator or librarian accounts.'
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Name, email, and password are required.'
      });
    }

    if (role === 'student' && !studentId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Student ID is required for student accounts.'
      });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        data: null,
        message: 'Email already exists.'
      });
    }

    if (studentId) {
      const idExists = await User.findOne({ studentId });
      if (idExists) {
        return res.status(409).json({
          success: false,
          data: null,
          message: 'Student ID already exists.'
        });
      }
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      role,
      name,
      email: email.toLowerCase(),
      studentId: role === 'student' ? studentId : undefined,
      phone,
      department,
      year,
      passwordHash,
      status
    });

    await logAudit(req, 'CREATE_USER', 'User', newUser._id, { role, name, email });

    const userObj = newUser.toObject();
    delete userObj.passwordHash;

    return res.status(201).json({
      success: true,
      data: userObj,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully.`
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single user by ID (with profile details: loans, reservations, fines)
// @route GET /api/v1/users/:id
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -resetTokenHash');
    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Role check: Students can only view themselves
    if (req.user.role === 'student' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Access denied: Students can only view their own profile.'
      });
    }

    // Librarians cannot access admin or other librarian accounts
    if (req.user.role === 'librarian' && user.role !== 'student' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Librarians can only view student profiles.'
      });
    }

    // Fetch related records if student
    let loans = [];
    let reservations = [];
    let fines = [];

    if (user.role === 'student') {
      loans = await Loan.find({ studentId: user._id })
        .populate('bookId', 'title isbn coverUrl')
        .populate('copyId', 'accessionNumber')
        .sort({ createdAt: -1 })
        .limit(50);

      reservations = await Reservation.find({ studentId: user._id })
        .populate('bookId', 'title isbn coverUrl')
        .sort({ createdAt: -1 });

      fines = await Fine.find({ studentId: user._id })
        .populate({
          path: 'loanId',
          populate: { path: 'bookId', select: 'title isbn' }
        })
        .sort({ createdAt: -1 });
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
        loans,
        reservations,
        fines
      },
      message: 'User profile retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update user
// @route PUT /api/v1/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    if (req.user.role === 'librarian' && targetUser.role !== 'student') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Librarians can only update student records.'
      });
    }

    const { name, phone, department, year, status } = req.body;
    if (name) targetUser.name = name;
    if (phone !== undefined) targetUser.phone = phone;
    if (department !== undefined) targetUser.department = department;
    if (year !== undefined) targetUser.year = year;
    if (status && ['active', 'pending', 'suspended', 'graduated'].includes(status)) {
      targetUser.status = status;
    }

    await targetUser.save();
    await logAudit(req, 'UPDATE_USER', 'User', targetUser._id, { updates: req.body });

    const userObj = targetUser.toObject();
    delete userObj.passwordHash;

    return res.status(200).json({
      success: true,
      data: userObj,
      message: 'User updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update user status (e.g. approve pending, suspend, activate)
// @route PATCH /api/v1/users/:id/status
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'pending', 'suspended', 'graduated'].includes(status)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid status value'
      });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    if (req.user.role === 'librarian' && targetUser.role !== 'student') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Librarians can only manage student account statuses.'
      });
    }

    const oldStatus = targetUser.status;
    targetUser.status = status;
    await targetUser.save();

    await logAudit(req, 'CHANGE_USER_STATUS', 'User', targetUser._id, { from: oldStatus, to: status });

    return res.status(200).json({
      success: true,
      data: { id: targetUser._id, status: targetUser.status },
      message: `Account status updated to ${status}.`
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete user (Soft deactivation if transactions exist; Admin only)
// @route DELETE /api/v1/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Check if user has active or historical loans
    const hasLoans = await Loan.exists({ studentId: targetUser._id });
    const hasReservations = await Reservation.exists({ studentId: targetUser._id });

    if (hasLoans || hasReservations) {
      // Deactivate instead of deleting (Section D: Deactivation instead of deletion for anyone with transaction history)
      targetUser.status = 'suspended';
      await targetUser.save();
      await logAudit(req, 'DEACTIVATE_USER_WITH_HISTORY', 'User', targetUser._id);

      return res.status(200).json({
        success: true,
        data: null,
        message: 'User has transaction history. Account has been deactivated/suspended instead of permanently deleted.'
      });
    }

    await User.findByIdAndDelete(targetUser._id);
    await logAudit(req, 'DELETE_USER', 'User', targetUser._id);

    return res.status(200).json({
      success: true,
      data: null,
      message: 'User permanently deleted.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update own profile
// @route PUT /api/v1/users/me
exports.updateMe = async (req, res, next) => {
  try {
    const { name, phone, department, year, photoUrl } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (year !== undefined) user.year = year;
    if (photoUrl !== undefined) user.photoUrl = photoUrl;

    await user.save();
    await logAudit(req, 'UPDATE_PROFILE', 'User', user._id);

    const userObj = user.toObject();
    delete userObj.passwordHash;

    return res.status(200).json({
      success: true,
      data: userObj,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update own password
// @route PUT /api/v1/users/me/password
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Current password and new password are required.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'New password must be at least 8 characters long.'
      });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Current password does not match.'
      });
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    await logAudit(req, 'CHANGE_PASSWORD', 'User', user._id);

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
