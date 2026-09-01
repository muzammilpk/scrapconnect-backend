const mongoose = require('mongoose');
const { Scrap, scrapCategories } = require('../models/scrap.model');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const {
  findMatchingBuyersForLocation,
  findMatchingBuyersForScrap,
} = require('../services/locationMatchingService');
const notificationService = require('../services/notificationService');

/**
 * Helper to upload buffer to Cloudinary using stream
 */
const uploadToCloudinary = (fileBuffer, folder = 'scrapconnect_scraps') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * @desc   Upload scrap images to Cloudinary (or fallback handler)
 * @route  POST /api/scraps/upload
 * @access Private (Seller only)
 */
const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one image file to upload',
      });
    }

    const uploadedImages = [];

    if (isCloudinaryConfigured()) {
      // Upload to Cloudinary
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        uploadedImages.push(result);
      }
    } else {
      // Local development fallback if Cloudinary credentials not added yet
      for (const file of req.files) {
        const base64Data = file.buffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64Data}`;
        uploadedImages.push({
          url: dataUrl,
          publicId: `dev_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      images: uploadedImages,
    });
  } catch (error) {
    console.error('Image upload error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while uploading images',
    });
  }
};

/**
 * @desc   Create a new scrap listing
 * @route  POST /api/scraps
 * @access Private (Seller only)
 */
const createScrap = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      images,
      estimatedWeight,
      weightUnit,
      expectedPrice,
      location,
      status = 'available',
    } = req.body;

    // 1. Validation: Title & Category
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Scrap title is required',
      });
    }

    if (!category || !scrapCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Please select a valid category (${scrapCategories.join(', ')})`,
      });
    }

    // Optional Numeric Weight Validation
    let parsedWeight = null;
    if (estimatedWeight !== undefined && estimatedWeight !== null && estimatedWeight !== '') {
      parsedWeight = Number(estimatedWeight);
      if (isNaN(parsedWeight) || parsedWeight < 0) {
        return res.status(400).json({
          success: false,
          message: 'Estimated weight must be a positive number',
        });
      }
    }

    // Optional Numeric Expected Price Validation
    let parsedPrice = null;
    if (expectedPrice !== undefined && expectedPrice !== null && expectedPrice !== '') {
      parsedPrice = Number(expectedPrice);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Expected price must be a non-negative number',
        });
      }
    }

    if (!location || typeof location !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Location details (state, district, city) are required',
      });
    }

    const { state, district, city, area, pincode, latitude, longitude } = location;

    if (!state || !state.trim() || !district || !district.trim() || !city || !city.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Location state, district, and city are required',
      });
    }

    const listingStatus = ['available', 'draft'].includes(status) ? status : 'available';

    // 2. Create listing attached to seller
    const scrap = await Scrap.create({
      seller: req.user._id,
      title: title.trim(),
      category,
      description: description ? description.trim() : '',
      images: Array.isArray(images) ? images : [],
      estimatedWeight: parsedWeight,
      weightUnit: weightUnit && ['kg', 'ton', 'g', 'items'].includes(weightUnit) ? weightUnit : 'kg',
      expectedPrice: parsedPrice,
      location: {
        state: state.trim(),
        district: district.trim(),
        city: city.trim(),
        area: area ? area.trim() : '',
        pincode: pincode ? pincode.trim() : '',
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      },
      status: listingStatus,
    });

    const populatedScrap = await Scrap.findById(scrap._id).populate(
      'seller',
      'name email mobileNumber profileImage'
    );

    let matchingBuyerCount = 0;

    // Trigger notifications only if listing status is 'available' (do not notify for draft listings)
    if (listingStatus === 'available') {
      const matchingBuyers = await findMatchingBuyersForLocation(populatedScrap.location);
      matchingBuyerCount = matchingBuyers.length;

      console.log(
        `📍 [Location Matching] Found ${matchingBuyerCount} matching buyer(s) for Scrap ID: ${scrap._id} in ${populatedScrap.location.city}, ${populatedScrap.location.district}`
      );

      try {
        await notificationService.createScrapNotificationsForMatchingBuyers(populatedScrap);
      } catch (notifErr) {
        console.error('⚠️ [Notification System] Failed to dispatch notifications:', notifErr.message);
      }
    } else {
      console.log(`📝 [Draft Scrap] Scrap ID: ${scrap._id} saved as draft. Location matching notifications skipped.`);
    }

    res.status(201).json({
      success: true,
      message: listingStatus === 'draft' ? 'Scrap listing saved as draft' : 'Scrap listing published successfully',
      scrap: populatedScrap,
      matchingBuyerCount,
    });
  } catch (error) {
    console.error('Create scrap error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating scrap listing',
    });
  }
};

/**
 * @desc   Get all scrap listings posted by the logged-in seller with stats summary
 * @route  GET /api/scraps/my-listings
 * @access Private (Seller only)
 */
const getMyScrapListings = async (req, res) => {
  try {
    const { status, search, category } = req.query;

    const query = { seller: req.user._id };

    if (status && status !== 'all') {
      query.status = status.trim();
    } else {
      // Exclude soft-removed items by default unless explicitly asked for
      query.status = { $ne: 'removed' };
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { title: searchRegex },
        { category: searchRegex },
        { description: searchRegex },
      ];
    }

    if (category && category.trim() && category.trim() !== 'All Categories') {
      query.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
    }

    const [scraps, allSellerScraps] = await Promise.all([
      Scrap.find(query).sort({ createdAt: -1 }).populate('seller', 'name email mobileNumber'),
      Scrap.find({ seller: req.user._id, status: { $ne: 'removed' } }),
    ]);

    const stats = {
      totalCount: allSellerScraps.length,
      availableCount: allSellerScraps.filter((s) => s.status === 'available').length,
      reservedCount: allSellerScraps.filter((s) => s.status === 'reserved').length,
      soldCount: allSellerScraps.filter((s) => s.status === 'sold').length,
      draftCount: allSellerScraps.filter((s) => s.status === 'draft').length,
    };

    res.status(200).json({
      success: true,
      count: scraps.length,
      scraps,
      stats,
    });
  } catch (error) {
    console.error('Get my listings error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving your listings',
    });
  }
};

/**
 * @desc   Get a single scrap listing by ID
 * @route  GET /api/scraps/:id
 * @access Private
 */
const getScrapById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid scrap ID format',
      });
    }

    const scrap = await Scrap.findById(id).populate(
      'seller',
      'name email mobileNumber profileImage location'
    );

    if (!scrap || scrap.status === 'removed') {
      return res.status(404).json({
        success: false,
        message: 'Scrap listing not found',
      });
    }

    res.status(200).json({
      success: true,
      scrap,
    });
  } catch (error) {
    console.error('Get scrap by ID error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving scrap details',
    });
  }
};

/**
 * @desc   Update a scrap listing (Owner seller only)
 * @route  PUT / PATCH /api/scraps/:id
 * @access Private (Seller owner only)
 */
const updateScrap = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid scrap ID format',
      });
    }

    const scrap = await Scrap.findById(id);

    if (!scrap || scrap.status === 'removed') {
      return res.status(404).json({
        success: false,
        message: 'Scrap listing not found',
      });
    }

    // Security check: Only owner seller can update
    if (scrap.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this scrap listing',
      });
    }

    const {
      title,
      category,
      description,
      images,
      estimatedWeight,
      weightUnit,
      expectedPrice,
      location,
      status,
    } = req.body;

    // Business Guardrails: If status is reserved or sold, restrict modifying core transaction terms
    if (['reserved', 'sold'].includes(scrap.status)) {
      const isTryingToEditRestrictedFields =
        (category !== undefined && category !== scrap.category) ||
        (estimatedWeight !== undefined && Number(estimatedWeight) !== scrap.estimatedWeight) ||
        (expectedPrice !== undefined && Number(expectedPrice) !== scrap.expectedPrice) ||
        (location !== undefined && typeof location === 'object');

      if (isTryingToEditRestrictedFields) {
        return res.status(400).json({
          success: false,
          message: `Cannot edit category, weight, price, or location of a ${scrap.status} listing`,
        });
      }
    }

    const wasDraft = scrap.status === 'draft';

    if (title !== undefined) scrap.title = title.trim();
    if (category !== undefined && scrapCategories.includes(category)) scrap.category = category;
    if (description !== undefined) scrap.description = description.trim();
    if (images !== undefined && Array.isArray(images)) scrap.images = images;

    if (estimatedWeight !== undefined) {
      if (estimatedWeight === null || estimatedWeight === '') {
        scrap.estimatedWeight = null;
      } else if (!isNaN(estimatedWeight) && Number(estimatedWeight) >= 0) {
        scrap.estimatedWeight = Number(estimatedWeight);
      }
    }

    if (weightUnit !== undefined && ['kg', 'ton', 'g', 'items'].includes(weightUnit)) {
      scrap.weightUnit = weightUnit;
    }

    if (expectedPrice !== undefined) {
      if (expectedPrice === null || expectedPrice === '') {
        scrap.expectedPrice = null;
      } else if (!isNaN(expectedPrice) && Number(expectedPrice) >= 0) {
        scrap.expectedPrice = Number(expectedPrice);
      }
    }

    if (status !== undefined && ['draft', 'available', 'reserved', 'sold', 'removed'].includes(status)) {
      scrap.status = status;
    }

    if (location && typeof location === 'object') {
      const { state, district, city, area, pincode, latitude, longitude } = location;
      scrap.location = {
        state: state !== undefined ? state.trim() : scrap.location.state,
        district: district !== undefined ? district.trim() : scrap.location.district,
        city: city !== undefined ? city.trim() : scrap.location.city,
        area: area !== undefined ? area.trim() : scrap.location.area,
        pincode: pincode !== undefined ? pincode.trim() : scrap.location.pincode,
        latitude: latitude !== undefined ? Number(latitude) : scrap.location.latitude,
        longitude: longitude !== undefined ? Number(longitude) : scrap.location.longitude,
      };
    }

    await scrap.save();

    const updatedScrap = await Scrap.findById(id).populate(
      'seller',
      'name email mobileNumber'
    );

    // If publishing a listing from draft to available, send notifications to matching buyers
    if (wasDraft && updatedScrap.status === 'available') {
      try {
        await notificationService.createScrapNotificationsForMatchingBuyers(updatedScrap);
      } catch (notifErr) {
        console.error('⚠️ [Notification System] Failed to dispatch notifications on draft publish:', notifErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Scrap listing updated successfully',
      scrap: updatedScrap,
    });
  } catch (error) {
    console.error('Update scrap error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating scrap listing',
    });
  }
};

/**
 * @desc   Remove a scrap listing (Soft delete: status = 'removed')
 * @route  DELETE /api/scraps/:id
 * @access Private (Seller owner only)
 */
const deleteScrap = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid scrap ID format',
      });
    }

    const scrap = await Scrap.findById(id);

    if (!scrap || scrap.status === 'removed') {
      return res.status(404).json({
        success: false,
        message: 'Scrap listing not found',
      });
    }

    // Security check: Only owner seller can remove
    if (scrap.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to remove this scrap listing',
      });
    }

    // Soft delete: mark status as removed
    scrap.status = 'removed';
    await scrap.save();

    res.status(200).json({
      success: true,
      message: 'Scrap listing removed successfully',
    });
  } catch (error) {
    console.error('Delete scrap error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error removing scrap listing',
    });
  }
};

/**
 * Helper to escape regex special characters
 */
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * @desc   Get all available scrap listings (Marketplace query with search, filter, sort, pagination)
 * @route  GET /api/scraps
 * @access Private
 */
const getAllScraps = async (req, res) => {
  try {
    const {
      search,
      category,
      state,
      district,
      city,
      area,
      pincode,
      minWeight,
      maxWeight,
      status,
      sort,
      page = 1,
      limit = 12,
    } = req.query;

    // 1. Build Query Object (Default to status: 'available' unless specified)
    const query = {
      status: status ? status.trim() : 'available',
    };

    // Keyword Search (across title, category, description)
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { title: searchRegex },
        { category: searchRegex },
        { description: searchRegex },
      ];
    }

    // Category filter
    if (category && category.trim() && category.trim() !== 'All Categories') {
      const catRegex = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
      query.category = catRegex;
    }

    // Weight filtering (minWeight and maxWeight)
    const minW = parseFloat(minWeight);
    const maxW = parseFloat(maxWeight);
    if (!isNaN(minW) || !isNaN(maxW)) {
      query.estimatedWeight = {};
      if (!isNaN(minW)) {
        query.estimatedWeight.$gte = minW;
      }
      if (!isNaN(maxW)) {
        query.estimatedWeight.$lte = maxW;
      }
    }

    // Location filters (case-insensitive & trimmed)
    if (state && state.trim()) {
      query['location.state'] = new RegExp(`^${escapeRegex(state.trim())}$`, 'i');
    }
    if (district && district.trim()) {
      query['location.district'] = new RegExp(`^${escapeRegex(district.trim())}$`, 'i');
    }
    if (city && city.trim()) {
      query['location.city'] = new RegExp(`^${escapeRegex(city.trim())}$`, 'i');
    }
    if (area && area.trim()) {
      query['location.area'] = new RegExp(escapeRegex(area.trim()), 'i');
    }
    if (pincode && pincode.trim()) {
      query['location.pincode'] = new RegExp(`^${escapeRegex(pincode.trim())}$`, 'i');
    }

    // 2. Strict Sorting Whitelist
    let sortOptions = { createdAt: -1 }; // Default: Newest first
    if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    } else if (sort === 'weight_low' || sort === 'weight_asc') {
      sortOptions = { estimatedWeight: 1 };
    } else if (sort === 'weight_high' || sort === 'weight_desc') {
      sortOptions = { estimatedWeight: -1 };
    } else if (sort === 'newest') {
      sortOptions = { createdAt: -1 };
    }

    // 3. Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    // Execute query and total count in parallel
    const [scraps, totalListings] = await Promise.all([
      Scrap.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate('seller', 'name email mobileNumber profileImage location'),
      Scrap.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalListings / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: scraps,
      scraps: scraps, // Backwards compatibility
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalListings,
        totalPages,
      },
      count: scraps.length,
      page: pageNum,
      limit: limitNum,
      totalPages,
      totalListings,
    });
  } catch (error) {
    console.error('Get all scraps error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving marketplace listings',
    });
  }
};

/**
 * @desc   Get matching buyers for a scrap listing based on location & service regions
 * @route  GET /api/scraps/:id/matching-buyers
 * @access Private (Seller owner or Admin only)
 */
const getMatchingBuyersForScrap = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid scrap ID format',
      });
    }

    const scrap = await Scrap.findById(id).populate('seller', 'name email mobileNumber');

    if (!scrap) {
      return res.status(404).json({
        success: false,
        message: 'Scrap listing not found',
      });
    }

    // Security check: Only the owner seller or an admin can access matching buyers
    if (scrap.seller._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view matching buyers for this listing',
      });
    }

    const matchingBuyers = await findMatchingBuyersForLocation(scrap.location);

    res.status(200).json({
      success: true,
      count: matchingBuyers.length,
      scrapId: scrap._id,
      scrapLocation: scrap.location,
      buyers: matchingBuyers,
    });
  } catch (error) {
    console.error('Get matching buyers error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error finding matching buyers',
    });
  }
};

module.exports = {
  uploadImages,
  createScrap,
  getMyScrapListings,
  getAllScraps,
  getScrapById,
  updateScrap,
  deleteScrap,
  getMatchingBuyersForScrap,
};
