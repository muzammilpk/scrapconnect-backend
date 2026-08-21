const Notification = require('../models/notification.model');
const { findMatchingBuyersForLocation } = require('./locationMatchingService');

/**
 * Creates location-based notifications for matching buyers when a seller posts a scrap.
 * Guarantees duplicate prevention so each buyer gets at most 1 notification per scrap listing.
 * 
 * @param {Object} scrap - Created scrap document (populated or raw)
 * @returns {Promise<Array>} List of created notification documents
 */
const createScrapNotificationsForMatchingBuyers = async (scrap) => {
  if (!scrap || !scrap._id || !scrap.location) {
    return [];
  }

  // 1. Find matching buyers using existing location matching service
  const matchingBuyers = await findMatchingBuyersForLocation(scrap.location);

  if (!matchingBuyers || matchingBuyers.length === 0) {
    console.log(`ℹ️ [Notification Service] No matching buyers for Scrap ID: ${scrap._id} in ${scrap.location.city}`);
    return [];
  }

  const createdNotifications = [];
  const city = scrap.location.city || 'your area';
  const weightInfo = `${scrap.estimatedWeight} ${scrap.weightUnit || 'kg'}`;
  const category = scrap.category || 'Scrap';

  const title = 'New Scrap Available Nearby';
  const message = `${weightInfo} of ${category} scrap is available in ${city}.`;

  // 2. Loop through matching buyers and create notifications (with deduplication check)
  for (const buyer of matchingBuyers) {
    try {
      // Deduplication check: Do not create duplicate notification if already exists
      const existingNotification = await Notification.findOne({
        recipient: buyer.id,
        scrap: scrap._id,
      });

      if (!existingNotification) {
        const notification = await Notification.create({
          recipient: buyer.id,
          type: 'new_scrap_nearby',
          title,
          message,
          scrap: scrap._id,
          isRead: false,
        });

        createdNotifications.push(notification);
      }
    } catch (err) {
      console.error(`⚠️ Failed to create notification for buyer ${buyer.id}:`, err.message);
    }
  }

  console.log(
    `🔔 [Notification Service] Created ${createdNotifications.length} notification(s) for Scrap ID: ${scrap._id}`
  );

  return createdNotifications;
};

/**
 * Get paginated notifications for a recipient user
 */
const getNotificationsForUser = async (userId, page = 1, limit = 15) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
  const skip = (pageNum - 1) * limitNum;

  const [notifications, totalCount, unreadCount] = await Promise.all([
    Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('scrap', 'title category description images estimatedWeight weightUnit location status createdAt'),
    Notification.countDocuments({ recipient: userId }),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  const totalPages = Math.ceil(totalCount / limitNum) || 1;

  return {
    notifications,
    page: pageNum,
    limit: limitNum,
    totalPages,
    totalCount,
    unreadCount,
  };
};

/**
 * Get unread notification count for a recipient user
 */
const getUnreadCountForUser = async (userId) => {
  const count = await Notification.countDocuments({ recipient: userId, isRead: false });
  return count;
};

/**
 * Mark a single notification as read for a recipient user
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({ _id: notificationId, recipient: userId });
  if (!notification) {
    return null;
  }

  notification.isRead = true;
  await notification.save();
  return notification;
};

/**
 * Mark all notifications as read for a recipient user
 */
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true }
  );
  return result;
};

/**
 * Delete a notification for a recipient user
 */
const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
  return notification;
};

module.exports = {
  createScrapNotificationsForMatchingBuyers,
  getNotificationsForUser,
  getUnreadCountForUser,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
