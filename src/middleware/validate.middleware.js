const mongoose = require('mongoose');

/**
 * Middleware to validate MongoDB ObjectId format in request parameters
 * @param {...String} paramNames - Parameter names to validate (e.g., 'id', 'scrapId', 'conversationId')
 */
const validateObjectId = (...paramNames) => {
  return (req, res, next) => {
    for (const paramName of paramNames) {
      const paramValue = req.params[paramName];
      if (paramValue && !mongoose.Types.ObjectId.isValid(paramValue)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${paramName} format`,
        });
      }
    }
    next();
  };
};

/**
 * Helper function to sanitize a string against dangerous HTML/script injection
 * @param {String} str 
 * @returns {String}
 */
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove <script> tags
    .replace(/on\w+="[^"]*"/gi, '') // Remove inline event listeners like onload="..."
    .replace(/javascript:[^\s'"]*/gi, '') // Remove javascript: URIs
    .trim();
};

/**
 * Middleware to recursively sanitize request body string inputs
 */
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (typeof obj[key] === 'string') {
            obj[key] = sanitizeInput(obj[key]);
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
          }
        }
      }
    };
    sanitizeObject(req.body);
  }
  next();
};

module.exports = {
  validateObjectId,
  sanitizeInput,
  sanitizeBody,
};
