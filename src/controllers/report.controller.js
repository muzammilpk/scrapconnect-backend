const mongoose = require('mongoose');
const Report = require('../models/report.model');

/**
 * @desc   Submit a platform report (User, Scrap, or Review)
 * @route  POST /api/reports
 * @access Private
 */
const createReport = async (req, res) => {
  try {
    const { reportedUserId, reportedScrapId, reportedReviewId, reason, description } = req.body;

    if (!reason || !['spam', 'inappropriate_content', 'fraud', 'abusive_behavior', 'other'].includes(reason)) {
      return res.status(400).json({
        success: false,
        message: 'Valid report reason is required (spam, inappropriate_content, fraud, abusive_behavior, other)',
      });
    }

    if (!reportedUserId && !reportedScrapId && !reportedReviewId) {
      return res.status(400).json({
        success: false,
        message: 'Please specify an item or user to report',
      });
    }

    const report = await Report.create({
      reporter: req.user._id,
      ...(reportedUserId && mongoose.Types.ObjectId.isValid(reportedUserId) && { reportedUser: reportedUserId }),
      ...(reportedScrapId && mongoose.Types.ObjectId.isValid(reportedScrapId) && { reportedScrap: reportedScrapId }),
      ...(reportedReviewId && mongoose.Types.ObjectId.isValid(reportedReviewId) && { reportedReview: reportedReviewId }),
      reason,
      description: description ? String(description).trim().substring(0, 1000) : '',
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Administrators will review your concern.',
      report,
    });
  } catch (error) {
    console.error('Create report error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating report',
    });
  }
};

module.exports = {
  createReport,
};
