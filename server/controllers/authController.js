const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Setting = require('../models/Setting');
const { logAudit } = require('../utils/auditLogger');
const { sendEmail } = require('../services/emailService');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET || 'super_secret_lms_access_jwt_key_2026_xyz_long_token',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET || 'super_secret_lms_refresh_jwt_key_2026_xyz_long_token',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// @desc Register Student
// @route POST /api/v1/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, studentId, phone, department, year, password } = req.body;

    if (!name || !email || !studentId || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Name, Email, Student ID, and Password are required.'
      });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        data: null,
        message: 'An account with this email address already exists.'
      });
    }

    const idExists = await User.findOne({ studentId });
    if (idExists) {
      return res.status(409).json({
        success: false,
        data: null,
        message: 'An account with this Student ID already exists.'
      });
    }

    const settings = await Setting.findOne() || { registrationMode: 'approval' };
    const initialStatus = settings.registrationMode === 'auto' ? 'active' : 'pending';

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      role: 'student',
      name,
      email: email.toLowerCase(),
      studentId,
      phone,
      department,
      year,
      passwordHash,
      status: initialStatus
    });

    await logAudit(req, 'REGISTER_STUDENT', 'User', newUser._id, {
      name,
      email,
      studentId,
      status: initialStatus
    });

    return res.status(201).json({
      success: true,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        studentId: newUser.studentId,
        status: newUser.status
      },
      message:
        initialStatus === 'active'
          ? 'Registration successful! You may now log in.'
          : 'Registration successful! Your account is pending librarian approval before you can log in.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Login User
// @route POST /api/v1/auth/login
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or studentId

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Please provide email/student ID and password.'
      });
    }

    const trimmed = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: trimmed }, { studentId: identifier.trim() }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Invalid credentials'
      });
    }

    // Check account lockout
    if (user.isLocked()) {
      const minutesRemaining = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(403).json({
        success: false,
        data: null,
        message: `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${minutesRemaining} minute(s).`
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      const attemptsLeft = Math.max(0, 5 - user.failedLoginCount);
      return res.status(401).json({
        success: false,
        data: null,
        message: `Invalid credentials. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) remaining before lockout.` : 'Account has been locked for 15 minutes.'}`
      });
    }

    // Status check
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Your account has been suspended. Please contact the library administration.'
      });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Your account is pending review and activation by a librarian.'
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in HTTP-only cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    await logAudit({ user, ...req }, 'LOGIN', 'User', user._id, { role: user.role });

    return res.status(200).json({
      success: true,
      data: {
        token: accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: user.studentId,
          department: user.department,
          year: user.year,
          photoUrl: user.photoUrl,
          status: user.status
        }
      },
      message: 'Login successful'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Refresh Token
// @route POST /api/v1/auth/refresh
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refresh_token || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Refresh token not found'
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'super_secret_lms_refresh_jwt_key_2026_xyz_long_token'
    );

    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Invalid refresh session or inactive account'
      });
    }

    const newAccessToken = generateAccessToken(user);

    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      data: { token: newAccessToken },
      message: 'Token refreshed'
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      message: 'Session expired. Please log in again.'
    });
  }
};

// @desc Logout User
// @route POST /api/v1/auth/logout
exports.logout = async (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  return res.status(200).json({
    success: true,
    data: null,
    message: 'Logged out successfully'
  });
};

// @desc Forgot Password
// @route POST /api/v1/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Please provide an email address'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return identical success response to prevent account enumeration (Section A6)
    const successMsg = 'If that email address is registered, a password reset link has been dispatched.';

    if (!user) {
      return res.status(200).json({
        success: true,
        data: null,
        message: successMsg
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetTokenHash = resetTokenHash;
    user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    await user.save();

    const resetUrl = `${req.protocol}://${req.get('host')}/#/reset-password/${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: 'LMS Password Reset Request',
      text: `You requested a password reset. Please use the following link within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
      html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link is valid for 30 minutes.</p>`
    });

    await logAudit(req, 'FORGOT_PASSWORD_REQUEST', 'User', user._id, { email: user.email });

    return res.status(200).json({
      success: true,
      data: process.env.NODE_ENV === 'development' ? { resetToken, resetUrl } : null,
      message: successMsg
    });
  } catch (error) {
    next(error);
  }
};

// @desc Reset Password with token
// @route POST /api/v1/auth/reset-password/:token
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Password must be at least 8 characters with at least one letter and one number.'
      });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetTokenHash,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid or expired password reset token.'
      });
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.resetTokenHash = undefined;
    user.resetTokenExpiry = undefined;
    user.failedLoginCount = 0;
    user.lockUntil = undefined;
    await user.save();

    await logAudit(req, 'RESET_PASSWORD_SUCCESS', 'User', user._id);

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Password reset successful. You can now log in with your new password.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get current logged-in user
// @route GET /api/v1/auth/me
exports.getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: req.user,
    message: 'User profile retrieved'
  });
};
