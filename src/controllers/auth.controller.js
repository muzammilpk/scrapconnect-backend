const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/user.model');

/**
 * Generate JWT token
 * @param {string} id - User ID
 * @param {string} role - User Role ('buyer' | 'seller')
 */
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, config.jwtSecret, {
    expiresIn: '30d',
  });
};

/**
 * @desc   Register new user (buyer or seller)
 * @route  POST /api/auth/register
 * @access Public
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, mobileNumber, password, role } = req.body;

    // 1. Validation: Basic required fields
    if (!name || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, password, and role (buyer or seller)',
      });
    }

    // 2. Validation: At least email or mobileNumber must be provided
    if (!email && !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address or mobile number',
      });
    }

    // 3. Validation: Role check
    if (!['buyer', 'seller', 'admin'].includes(role.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Role must be buyer, seller, or admin',
      });
    }

    // 4. Duplicate checks
    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists',
        });
      }
    }

    if (mobileNumber) {
      const existingMobile = await User.findOne({ mobileNumber });
      if (existingMobile) {
        return res.status(400).json({
          success: false,
          message: 'An account with this mobile number already exists',
        });
      }
    }

    // 5. Create user
    const user = await User.create({
      name,
      email: email ? email.toLowerCase() : undefined,
      mobileNumber: mobileNumber || undefined,
      password,
      role: role.toLowerCase(),
    });

    // 6. Generate token
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        profileImage: user.profileImage,
        address: user.address,
        location: user.location,
        serviceRegions: user.serviceRegions || [],
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  }
};

/**
 * @desc   Authenticate user & get token
 * @route  POST /api/auth/login
 * @access Public
 */
const loginUser = async (req, res) => {
  try {
    const { identifier, email, mobileNumber, password } = req.body;
    const loginQuery = identifier || email || mobileNumber;

    if (!loginQuery || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/mobile number and password',
      });
    }

    // Search user by email or mobileNumber
    const user = await User.findOne({
      $or: [
        { email: loginQuery.toLowerCase() },
        { mobileNumber: loginQuery },
      ],
    }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email/mobile and password.',
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        profileImage: user.profileImage,
        address: user.address,
        location: user.location,
        serviceRegions: user.serviceRegions || [],
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login',
    });
  }
};

/**
 * @desc   Get current logged in user profile
 * @route  GET /api/auth/me
 * @access Private
 */
const getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving profile',
    });
  }
};

/**
 * @desc   Change password for logged in user
 * @route  POST /api/auth/change-password
 * @access Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new password',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match',
      });
    }

    // Retrieve user including password field
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect current password',
      });
    }

    // Set new password (pre-save hook will hash it automatically)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error changing password',
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  changePassword,
};
