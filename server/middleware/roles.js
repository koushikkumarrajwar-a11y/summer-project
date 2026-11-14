const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        message: `Forbidden: User role '${req.user ? req.user.role : 'unauthenticated'}' is not authorized for this resource.`
      });
    }
    next();
  };
};

module.exports = { authorize };
