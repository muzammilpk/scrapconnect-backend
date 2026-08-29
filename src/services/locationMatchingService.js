const User = require('../models/user.model');
const { Scrap } = require('../models/scrap.model');

/**
 * Safely normalizes string values for comparison (trim + collapse whitespace + lowercase)
 * @param {string} str 
 * @returns {string}
 */
const normalizeStr = (str) => {
  if (!str) return '';
  return str.toString().trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * Escapes regex special characters in input strings
 * @param {string} text 
 * @returns {string}
 */
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * Calculate match specificity score and matched region details
 * @param {Object} scrapLoc 
 * @param {Object} region 
 * @returns {Object|null} Match result with score and matchedRegion info, or null if no match
 */
const evaluateRegionMatch = (scrapLoc, region) => {
  const sState = normalizeStr(scrapLoc.state);
  const sDistrict = normalizeStr(scrapLoc.district);
  const sCity = normalizeStr(scrapLoc.city);
  const sArea = normalizeStr(scrapLoc.area);
  const sPincode = normalizeStr(scrapLoc.pincode);

  const rState = normalizeStr(region.state);
  const rDistrict = normalizeStr(region.district);
  const rCity = normalizeStr(region.city);
  const rArea = normalizeStr(region.area);
  const rPincode = normalizeStr(region.pincode);

  // 1. Mandatory base coverage check: State and District must match
  if (sState !== rState || sDistrict !== rDistrict) {
    return null;
  }

  // 2. Exact Pincode Match (Highest Priority)
  if (rPincode && sPincode && rPincode === sPincode) {
    return {
      score: 100,
      matchReason: 'Exact Pincode Match',
      matchedRegion: {
        state: region.state,
        district: region.district,
        city: region.city,
        area: region.area || '',
        pincode: region.pincode,
      },
    };
  }

  // 3. Exact Area & City Match
  if (rArea && sArea && rArea === sArea && sCity === rCity) {
    return {
      score: 80,
      matchReason: 'Area & City Match',
      matchedRegion: {
        state: region.state,
        district: region.district,
        city: region.city,
        area: region.area,
        pincode: region.pincode || '',
      },
    };
  }

  // 4. City-level Match (If buyer did not specify a restrictive area/pincode or if city matches)
  if (sCity === rCity) {
    // If the buyer explicitly specified an area that doesn't match the scrap area, ignore
    if (rArea && sArea && rArea !== sArea) {
      return null;
    }
    // If buyer explicitly specified a pincode that doesn't match scrap pincode, ignore
    if (rPincode && sPincode && rPincode !== sPincode) {
      return null;
    }

    return {
      score: 60,
      matchReason: 'City Match',
      matchedRegion: {
        state: region.state,
        district: region.district,
        city: region.city,
        area: region.area || '',
        pincode: region.pincode || '',
      },
    };
  }

  // 5. District-level Match (Fallback if buyer specified city as wildcard or matching district)
  if (sDistrict === rDistrict) {
    // If buyer specified city/area/pincode that doesn't match scrap, exclude
    if (rCity && sCity && rCity !== sCity) {
      return null;
    }

    return {
      score: 40,
      matchReason: 'District Match',
      matchedRegion: {
        state: region.state,
        district: region.district,
        city: region.city || '',
        area: region.area || '',
        pincode: region.pincode || '',
      },
    };
  }

  return null;
};

/**
 * Finds eligible buyers whose service regions match the given scrap location.
 * Uses MongoDB query for fast pre-filtering, followed by exact rule evaluation & deduplication.
 * 
 * @param {Object} location - { state, district, city, area, pincode }
 * @returns {Promise<Array>} List of unique matching buyers with safe public data & matching region
 */
const findMatchingBuyersForLocation = async (location) => {
  if (!location || !location.state || !location.district || !location.city) {
    return [];
  }

  const { state, district, city, area, pincode } = location;

  const stateRegex = new RegExp(`^${escapeRegex(state.trim())}$`, 'i');
  const districtRegex = new RegExp(`^${escapeRegex(district.trim())}$`, 'i');
  const cityRegex = new RegExp(`^${escapeRegex(city.trim())}$`, 'i');

  // MongoDB Efficient Pre-filtering Query:
  // Find users with role 'buyer' who have at least one service region matching state & district
  const orConditions = [
    {
      'serviceRegions.state': stateRegex,
      'serviceRegions.district': districtRegex,
      'serviceRegions.city': cityRegex,
    },
  ];

  if (pincode && pincode.trim()) {
    orConditions.push({
      'serviceRegions.pincode': pincode.trim(),
    });
  }

  const potentialBuyers = await User.find({
    role: 'buyer',
    $or: orConditions,
  }).select('_id name email mobileNumber profileImage location serviceRegions createdAt');

  // Map to deduplicate buyers and select their best matching service region
  const buyerMap = new Map();

  for (const buyer of potentialBuyers) {
    if (!buyer.serviceRegions || buyer.serviceRegions.length === 0) continue;

    let bestMatch = null;

    for (const region of buyer.serviceRegions) {
      const matchResult = evaluateRegionMatch(location, region);

      if (matchResult) {
        if (!bestMatch || matchResult.score > bestMatch.score) {
          bestMatch = matchResult;
        }
      }
    }

    if (bestMatch) {
      buyerMap.set(buyer._id.toString(), {
        id: buyer._id,
        name: buyer.name,
        email: buyer.email || '',
        mobileNumber: buyer.mobileNumber || '',
        profileImage: buyer.profileImage || '',
        location: buyer.location || {},
        matchingRegion: bestMatch.matchedRegion,
        matchReason: bestMatch.matchReason,
        matchScore: bestMatch.score,
      });
    }
  }

  // Convert map values to array and sort by match score (highest score first)
  return Array.from(buyerMap.values()).sort((a, b) => b.matchScore - a.matchScore);
};

/**
 * Finds eligible buyers for a specific scrap listing ID
 * @param {string} scrapId 
 * @returns {Promise<{ scrap: Object, matchingBuyers: Array }>}
 */
const findMatchingBuyersForScrap = async (scrapId) => {
  const scrap = await Scrap.findById(scrapId).populate('seller', 'name email mobileNumber');
  if (!scrap) {
    throw new Error('Scrap listing not found');
  }

  const matchingBuyers = await findMatchingBuyersForLocation(scrap.location);

  return {
    scrap,
    matchingBuyers,
  };
};

module.exports = {
  findMatchingBuyersForLocation,
  findMatchingBuyersForScrap,
  evaluateRegionMatch,
};
