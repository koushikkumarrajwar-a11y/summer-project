const AuditLog = require('../models/AuditLog');

// @desc Get audit logs (Admin only)
// @route GET /api/v1/audit-logs
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { action, entity, page = 1, limit = 30 } = req.query;
    const query = {};

    if (action) query.action = action;
    if (entity) query.entity = entity;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('actorId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: {
        logs,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      },
      message: 'Audit logs retrieved'
    });
  } catch (error) {
    next(error);
  }
};
