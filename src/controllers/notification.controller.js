const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');

/**
 * @desc   Get authenticated user's notifications (Paginated)
 * @route  GET /api/notifications
 * @access Private
 */
const getUserNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;

    const data = await notificationService.getNotificationsForUser(req.user._id, page, limit);

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('Get notifications error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving notifications',
    });
  }
};

/**
 * @desc   Get unread notification count for authenticated user
 * @route  GET /api/notifications/unread-count
 * @access Private
 */
const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await notificationService.getUnreadCountForUser(req.user._id);

    res.status(200).json({
      success: true,
      count: unreadCount,
      unreadCount,
    });
  } catch (error) {
    console.error('Get unread count error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving unread count',
    });
  }
};

/**
 * @desc   Mark a single notification as read
 * @route  PATCH /api/notifications/:id/read
 * @access Private
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
    }

    const notification = await notificationService.markAsRead(id, req.user._id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    console.error('Mark read error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating notification',
    });
  }
};

/**
 * @desc   Mark all user's notifications as read
 * @route  PATCH /api/notifications/read-all
 * @access Private
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.user._id);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    console.error('Mark all read error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating notifications',
    });
  }
};

/**
 * @desc   Delete a notification
 * @route  DELETE /api/notifications/:id
 * @access Private
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
    }

    const notification = await notificationService.deleteNotification(id, req.user._id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Delete notification error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting notification',
    });
  }
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
};
