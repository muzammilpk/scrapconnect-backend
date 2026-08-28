const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/user.model');

/**
 * Middleware to verify JWT token and attach user to request object.
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Find user by decoded ID
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User belonging to this token no longer exists.',
        });
      }

      next();
    } catch (error) {
      console.error('JWT Authentication error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed or expired',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }
};

/**
 * Middleware for role-based access control.
 * @param {...String} roles - Allowed user roles ('buyer', 'seller', etc.)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user?.role}' is not authorized to access this resource`,
      });
    }
    next();
  };
};

/**
 * Reusable Middleware to enforce Admin role.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.',
    });
  }
  next();
};

/**
 * Reusable Middleware to check if user is suspended.
 */
const checkNotSuspended = (req, res, next) => {
  if (req.user && req.user.status === 'suspended') {
    return res.status(403).json({
      success: false,
      message: 'Your account has been suspended by an administrator.',
    });
  }
  next();
};

module.exports = {
  protect,
  authorize,
  requireAdmin,
  checkNotSuspended,
};
