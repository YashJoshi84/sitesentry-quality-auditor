import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, disconnectDB, getDatabaseStatus } from './config/db.js';
import auditRoutes from './routes/auditRoutes.js';
import { generalApiLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Standard Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// CORS Configuration
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) 
  : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
}));

// Body parsing with 100kb limit to mitigate large payload DoS
app.use(express.json({ limit: '100kb' }));

// Apply general rate limiting to API routes
app.use('/api/', generalApiLimiter);

// Request logging middleware
app.use((req, res, next) => {
  if (req.path !== '/api/health' && !req.path.includes('/progress')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbHealth = getDatabaseStatus();
  res.json({
    status: 'ok',
    service: 'SiteSentry Backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      connected: dbHealth.connected,
      storageType: dbHealth.storageType,
      isVolatile: dbHealth.isVolatile,
      readyState: dbHealth.readyStateText,
    },
  });
});

// Audit API Routes
app.use('/api/audits', auditRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

// Start Server
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 SiteSentry API Server active on http://localhost:${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful termination
process.on('SIGINT', async () => {
  console.log('\nShutting down SiteSentry gracefully...');
  await disconnectDB();
  process.exit(0);
});

startServer();
