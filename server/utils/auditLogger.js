const AuditLog = require('../models/AuditLog');

const logAudit = async (req, action, entity, entityId = '', details = {}) => {
  try {
    const actorId = req && req.user ? req.user._id : null;
    const actorName = req && req.user ? req.user.name : 'System/Guest';
    const actorRole = req && req.user ? req.user.role : 'system';
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : '';

    await AuditLog.create({
      actorId,
      actorName,
      actorRole,
      action,
      entity,
      entityId: String(entityId),
      details,
      ip
    });
  } catch (err) {
    console.error('[AuditLog Error]', err.message);
  }
};

module.exports = { logAudit };
