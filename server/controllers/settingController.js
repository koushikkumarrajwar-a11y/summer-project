const Setting = require('../models/Setting');
const { logAudit } = require('../utils/auditLogger');

// @desc Get system settings
// @route GET /api/v1/settings
exports.getSettings = async (req, res, next) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
    return res.status(200).json({
      success: true,
      data: settings,
      message: 'Settings retrieved'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update system settings (Admin only)
// @route PUT /api/v1/settings
exports.updateSettings = async (req, res, next) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }

    const updatable = [
      'libraryName',
      'libraryLogo',
      'contactEmail',
      'contactPhone',
      'address',
      'currency',
      'loanPeriodDays',
      'maxBooksPerStudent',
      'renewalLimit',
      'reservationPickupDays',
      'finePerDay',
      'maxFineCap',
      'fineBlockThreshold',
      'waiverApprovalThreshold',
      'registrationMode',
      'sessionTimeoutMinutes'
    ];

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    await settings.save();
    await logAudit(req, 'UPDATE_SETTINGS', 'Setting', settings._id, req.body);

    return res.status(200).json({
      success: true,
      data: settings,
      message: 'System settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
