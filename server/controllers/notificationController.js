const Notification = require('../models/Notification');

// @desc Get current user notifications
// @route GET /api/v1/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount
      },
      message: 'Notifications retrieved'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Mark single notification as read
// @route PATCH /api/v1/notifications/:id/read
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Mark all notifications as read
// @route PATCH /api/v1/notifications/read-all
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });

    return res.status(200).json({
      success: true,
      data: null,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};
