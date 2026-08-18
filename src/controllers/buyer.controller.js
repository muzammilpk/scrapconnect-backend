const User = require('../models/user.model');

/**
 * @desc   Get all service regions for the authenticated buyer
 * @route  GET /api/buyers/service-regions
 * @access Private (Buyer only)
 */
const getServiceRegions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Buyer profile not found',
      });
    }

    res.status(200).json({
      success: true,
      count: user.serviceRegions ? user.serviceRegions.length : 0,
      serviceRegions: user.serviceRegions || [],
    });
  } catch (error) {
    console.error('Get service regions error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving service regions',
    });
  }
};

/**
 * @desc   Add a new service region for the authenticated buyer
 * @route  POST /api/buyers/service-regions
 * @access Private (Buyer only)
 */
const addServiceRegion = async (req, res) => {
  try {
    const { state, district, city, area, pincode } = req.body;

    // 1. Basic field validation
    if (!state || !state.trim()) {
      return res.status(400).json({
        success: false,
        message: 'State is required',
      });
    }
    if (!district || !district.trim()) {
      return res.status(400).json({
        success: false,
        message: 'District is required',
      });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({
        success: false,
        message: 'City is required',
      });
    }

    // Pincode validation if provided
    if (pincode && pincode.trim()) {
      const pincodeRegex = /^[0-9]{5,10}$/;
      if (!pincodeRegex.test(pincode.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid pincode (5 to 10 digits)',
        });
      }
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Buyer profile not found',
      });
    }

    const newState = state.trim();
    const newDistrict = district.trim();
    const newCity = city.trim();
    const newArea = area ? area.trim() : '';

    // 2. Check for duplicate region
    const isDuplicate = user.serviceRegions.some((r) => {
      return (
        r.state.toLowerCase() === newState.toLowerCase() &&
        r.district.toLowerCase() === newDistrict.toLowerCase() &&
        r.city.toLowerCase() === newCity.toLowerCase() &&
        (r.area ? r.area.toLowerCase() : '') === newArea.toLowerCase()
      );
    });

    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: 'This service region has already been added to your profile',
      });
    }

    const newRegion = {
      state: newState,
      district: newDistrict,
      city: newCity,
      area: newArea,
      pincode: pincode ? pincode.trim() : '',
    };

    user.serviceRegions.push(newRegion);
    await user.save();

    const addedRegion = user.serviceRegions[user.serviceRegions.length - 1];

    res.status(201).json({
      success: true,
      message: 'Service region added successfully',
      region: addedRegion,
      serviceRegions: user.serviceRegions,
    });
  } catch (error) {
    console.error('Add service region error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error adding service region',
    });
  }
};

/**
 * @desc   Update an existing service region
 * @route  PUT /api/buyers/service-regions/:regionId
 * @access Private (Buyer only)
 */
const updateServiceRegion = async (req, res) => {
  try {
    const { regionId } = req.params;
    const { state, district, city, area, pincode } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Buyer profile not found',
      });
    }

    // Find target region subdocument
    const region = user.serviceRegions.id(regionId);
    if (!region) {
      return res.status(404).json({
        success: false,
        message: 'Service region not found',
      });
    }

    // Validate inputs if supplied
    const updatedState = state !== undefined ? state.trim() : region.state;
    const updatedDistrict = district !== undefined ? district.trim() : region.district;
    const updatedCity = city !== undefined ? city.trim() : region.city;
    const updatedArea = area !== undefined ? area.trim() : region.area;
    const updatedPincode = pincode !== undefined ? pincode.trim() : region.pincode;

    if (!updatedState || !updatedDistrict || !updatedCity) {
      return res.status(400).json({
        success: false,
        message: 'State, district, and city are required',
      });
    }

    if (updatedPincode) {
      const pincodeRegex = /^[0-9]{5,10}$/;
      if (!pincodeRegex.test(updatedPincode)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid pincode (5 to 10 digits)',
        });
      }
    }

    // Check duplicate against OTHER regions
    const isDuplicate = user.serviceRegions.some((r) => {
      if (r._id.toString() === regionId) return false;
      return (
        r.state.toLowerCase() === updatedState.toLowerCase() &&
        r.district.toLowerCase() === updatedDistrict.toLowerCase() &&
        r.city.toLowerCase() === updatedCity.toLowerCase() &&
        (r.area ? r.area.toLowerCase() : '') === updatedArea.toLowerCase()
      );
    });

    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: 'Another service region with these location details already exists',
      });
    }

    // Update region properties
    region.state = updatedState;
    region.district = updatedDistrict;
    region.city = updatedCity;
    region.area = updatedArea;
    region.pincode = updatedPincode;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Service region updated successfully',
      region,
      serviceRegions: user.serviceRegions,
    });
  } catch (error) {
    console.error('Update service region error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating service region',
    });
  }
};

/**
 * @desc   Delete a service region
 * @route  DELETE /api/buyers/service-regions/:regionId
 * @access Private (Buyer only)
 */
const deleteServiceRegion = async (req, res) => {
  try {
    const { regionId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Buyer profile not found',
      });
    }

    const region = user.serviceRegions.id(regionId);
    if (!region) {
      return res.status(404).json({
        success: false,
        message: 'Service region not found',
      });
    }

    user.serviceRegions.pull(regionId);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Service region deleted successfully',
      serviceRegions: user.serviceRegions,
    });
  } catch (error) {
    console.error('Delete service region error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting service region',
    });
  }
};

module.exports = {
  getServiceRegions,
  addServiceRegion,
  updateServiceRegion,
  deleteServiceRegion,
};
