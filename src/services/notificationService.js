const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const { findMatchingBuyersForLocation } = require('./locationMatchingService');
const { sendSocketNotification } = require('../socket/chatSocket');

/**
 * Generic notification creation helper with user preference check & socket dispatch
 */
const createNotification = async ({
  recipient,
  type,
  title,
  message,
  scrap = null,
  seller = null,
  conversation = null,
  deal = null,
}) => {
  try {
    if (!recipient || !type || !title || !message) return null;

    // Check recipient user status & notification preferences
    const recipientUser = await User.findById(recipient).select('status notificationPreferences');
    if (!recipientUser || recipientUser.status === 'suspended') {
      return null;
    }

    const prefs = recipientUser.notificationPreferences || {};
    if (type === 'NEW_SCRAP' || type === 'new_scrap_nearby') {
      if (prefs.newScrapInRegion === false) return null;
    } else if (type === 'NEW_MESSAGE') {
      if (prefs.newMessages === false) return null;
    } else if (['OFFER_RECEIVED', 'OFFER_ACCEPTED', 'OFFER_REJECTED'].includes(type)) {
      if (prefs.offers === false) return null;
    } else if (type === 'DEAL_UPDATE') {
      if (prefs.dealUpdates === false) return null;
    } else if (type === 'REVIEW_REQUEST') {
      if (prefs.reviewReminders === false) return null;
    }

    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      scrap,
      seller,
      conversation,
      deal,
      isRead: false,
    });

    const populatedNotif = await Notification.findById(notification._id)
      .populate('scrap', 'title category description images estimatedWeight weightUnit location status createdAt')
      .populate('seller', 'name profileImage role')
      .populate('deal', 'status finalPrice scheduledDate');

    // Emit real-time notification via Socket.IO
    sendSocketNotification(recipient, populatedNotif);

    return populatedNotif;
  } catch (err) {
    console.error(`⚠️ Failed to create notification (${type}) for user ${recipient}:`, err.message);
    return null;
  }
};

/**
 * Creates location-based notifications for matching buyers when a seller posts a scrap.
 * Guarantees seller exclusion and duplicate prevention so each buyer gets at most 1 notification per scrap listing.
 * 
 * @param {Object} scrap - Created scrap document (populated or raw)
 * @returns {Promise<Array>} List of created notification documents
 */
const createScrapNotificationsForMatchingBuyers = async (scrap) => {
  if (!scrap || !scrap._id || !scrap.location) {
    return [];
  }

  // 1. Determine seller ID string for exclusion check
  const sellerIdStr =
    typeof scrap.seller === 'object' && scrap.seller?._id
      ? scrap.seller._id.toString()
      : scrap.seller
      ? scrap.seller.toString()
      : '';

  // 2. Find matching buyers using location matching service
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

  // 3. Loop through matching buyers and create notifications
  for (const buyer of matchingBuyers) {
    const buyerIdStr = buyer.id.toString();

    // EXCLUSION CHECK: Seller must NOT receive notification for their own listing
    if (sellerIdStr && buyerIdStr === sellerIdStr) {
      continue;
    }

    try {
      // Deduplication check: Do not create duplicate notification if already exists
      const existingNotification = await Notification.findOne({
        recipient: buyer.id,
        scrap: scrap._id,
        type: { $in: ['NEW_SCRAP', 'new_scrap_nearby'] },
      });

      if (!existingNotification) {
        const notif = await createNotification({
          recipient: buyer.id,
          type: 'NEW_SCRAP',
          title,
          message,
          scrap: scrap._id,
          seller: sellerIdStr || null,
        });

        if (notif) {
          createdNotifications.push(notif);
        }
      }
    } catch (err) {
      console.error(`⚠️ Failed to create scrap notification for buyer ${buyer.id}:`, err.message);
    }
  }

  console.log(
    `🔔 [Notification Service] Created ${createdNotifications.length} region notification(s) for Scrap ID: ${scrap._id}`
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
      .populate('scrap', 'title category description images estimatedWeight weightUnit location status createdAt')
      .populate('seller', 'name profileImage role')
      .populate('deal', 'status finalPrice scheduledDate'),
    Notification.countDocuments({ recipient: userId }),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  const totalPages = Math.ceil(totalCount / limitNum) || 1;

  return {
    notifications,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages,
    },
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
  createNotification,
  createScrapNotificationsForMatchingBuyers,
  getNotificationsForUser,
  getUnreadCountForUser,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
