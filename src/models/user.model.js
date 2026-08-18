const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    mobileNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [/^[0-9]{10,15}$/, 'Please provide a valid mobile number (10-15 digits)'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Exclude password from query results by default
    },
    role: {
      type: String,
      enum: {
        values: ['buyer', 'seller'],
        message: 'Role must be either buyer or seller',
      },
      required: [true, 'Please specify user role (buyer or seller)'],
    },
    profileImage: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      state: { type: String, default: '', trim: true },
      district: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      area: { type: String, default: '', trim: true },
      pincode: { type: String, default: '', trim: true },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    serviceRegions: [
      {
        state: { type: String, required: [true, 'State is required'], trim: true },
        district: { type: String, required: [true, 'District is required'], trim: true },
        city: { type: String, required: [true, 'City is required'], trim: true },
        area: { type: String, default: '', trim: true },
        pincode: { type: String, default: '', trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare password during login
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Transform to remove password from JSON output
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
