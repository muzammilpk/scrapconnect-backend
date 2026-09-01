const mongoose = require('mongoose');

const scrapCategories = [
  'Paper',
  'Books',
  'Plastic',
  'Metal',
  'Iron',
  'Copper',
  'Aluminium',
  'Cardboard',
  'Bottles',
  'E-Waste',
  'Other',
];

const scrapSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Scrap listing must belong to a seller'],
    },
    title: {
      type: String,
      required: [true, 'Please provide a scrap title'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    category: {
      type: String,
      required: [true, 'Please select a scrap category'],
      enum: {
        values: scrapCategories,
        message: '{VALUE} is not a valid scrap category',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
      },
    ],
    estimatedWeight: {
      type: Number,
      min: [0, 'Weight cannot be negative'],
      default: null,
    },
    weightUnit: {
      type: String,
      enum: {
        values: ['kg', 'ton', 'g', 'items'],
        message: 'Weight unit must be kg, ton, g, or items',
      },
      default: 'kg',
    },
    expectedPrice: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: null,
    },
    location: {
      state: { type: String, required: [true, 'State is required'], trim: true },
      district: { type: String, required: [true, 'District is required'], trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      area: { type: String, default: '', trim: true },
      pincode: { type: String, default: '', trim: true },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'available', 'reserved', 'sold', 'removed'],
        message: 'Status must be draft, available, reserved, sold, or removed',
      },
      default: 'available',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance and fast location/category matching
scrapSchema.index({ status: 1, createdAt: -1 });
scrapSchema.index({ category: 1, status: 1 });
scrapSchema.index({ 'location.state': 1, 'location.district': 1, 'location.city': 1 });
scrapSchema.index({ title: 'text', description: 'text', category: 'text' });

const Scrap = mongoose.model('Scrap', scrapSchema);

module.exports = {
  Scrap,
  scrapCategories,
};
