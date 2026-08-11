const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Base Route
app.use('/api', apiRoutes);

// Root Endpoint Info
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to ScrapConnect API. Visit /api/health for system status.',
  });
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;
