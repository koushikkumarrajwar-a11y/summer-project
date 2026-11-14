require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { initCron } = require('./services/cronService');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bookRoutes = require('./routes/bookRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const circulationRoutes = require('./routes/circulationRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const fineRoutes = require('./routes/fineRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingRoutes = require('./routes/settingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static file directories
const uploadsPath = path.join(__dirname, '../uploads');
const clientPath = path.join(__dirname, '../client');

app.use('/uploads', express.static(uploadsPath));
app.use(express.static(clientPath));

// API Health Check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    message: 'LMS API is running smoothly'
  });
});

// Mount API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/books', bookRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/loans', circulationRoutes);
app.use('/api/v1/reservations', reservationRoutes);
app.use('/api/v1/fines', fineRoutes);
app.use('/api/v1/dashboard', reportRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/settings', settingRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/audit-logs', auditRoutes);

// Fallback to client/index.html for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Centralized error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect to DB and start server
const startServer = async () => {
  try {
    await connectDB();
    initCron();

    // Auto-seed if database is new
    const User = require('./models/User');
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      console.log('[Seed] No admin account detected. Running initial database seeder...');
      const { seedDatabase } = require('./seed/seedData');
      await seedDatabase();
    }

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`  Library Management System (LMS) Server Running!   `);
      console.log(`  Local URL: http://localhost:${PORT}               `);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'} `);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
  }
};

startServer();

module.exports = app;
