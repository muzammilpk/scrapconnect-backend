const User = require('../models/user.model');

/**
 * @desc   Get current logged in user profile
 * @route  GET /api/users/profile
 * @access Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching profile',
    });
  }
};

/**
 * @desc   Update current logged in user profile and location
 * @route  PUT /api/users/profile
 * @access Private
 */
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const {
      name,
      mobileNumber,
      profileImage,
      address,
      location,
    } = req.body;

    // 1. Validation: Name cannot be empty if supplied
    if (name !== undefined) {
      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Name cannot be empty',
        });
      }
      user.name = name.trim();
    }

    // 2. Validation: Mobile number uniqueness check if modified
    if (mobileNumber !== undefined && mobileNumber !== user.mobileNumber) {
      if (mobileNumber && mobileNumber.trim() !== '') {
        const mobileRegex = /^[0-9]{10,15}$/;
        if (!mobileRegex.test(mobileNumber.trim())) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid mobile number (10-15 digits)',
          });
        }

        const existingUser = await User.findOne({
          mobileNumber: mobileNumber.trim(),
          _id: { $ne: user._id },
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'An account with this mobile number already exists',
          });
        }
        user.mobileNumber = mobileNumber.trim();
      } else {
        user.mobileNumber = undefined;
      }
    }

    // 3. Optional profile image & address updates
    if (profileImage !== undefined) {
      user.profileImage = profileImage;
    }

    if (address !== undefined) {
      user.address = address.trim();
    }

    // 4. Update Location details if provided
    if (location && typeof location === 'object') {
      const { state, district, city, area, pincode, latitude, longitude } = location;

      if (pincode !== undefined && pincode !== '') {
        const pincodeClean = String(pincode).trim();
        const pincodeRegex = /^[0-9]{5,10}$/;
        if (!pincodeRegex.test(pincodeClean)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid pincode (5 to 10 digits)',
          });
        }
      }

      user.location = {
        state: state !== undefined ? String(state).trim() : user.location.state,
        district: district !== undefined ? String(district).trim() : user.location.district,
        city: city !== undefined ? String(city).trim() : user.location.city,
        area: area !== undefined ? String(area).trim() : user.location.area,
        pincode: pincode !== undefined ? String(pincode).trim() : user.location.pincode,
        latitude: latitude !== undefined && latitude !== '' ? Number(latitude) : user.location.latitude,
        longitude: longitude !== undefined && longitude !== '' ? Number(longitude) : user.location.longitude,
      };
    }

    // Save updated user to MongoDB
    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating profile',
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
