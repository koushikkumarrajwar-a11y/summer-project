const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      data: null,
      message: 'Access denied: Authentication token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_lms_access_jwt_key_2026_xyz_long_token');
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'User no longer exists'
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Account is suspended. Please contact the librarian.'
      });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Account pending activation by librarian or administrator.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      message: 'Invalid or expired session token',
      errors: error.message
    });
  }
};

module.exports = { protect };
