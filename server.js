// server.js
// ✅ HARDENING PRÉ-PROD :
//    - helmet (headers de sécurité)
//    - rate limiting global + strict sur /api/auth (anti brute-force)
//    - CORS nettoyé (credentials retiré — inutile pour une app mobile)
//    - /payment-test désactivé en production
//    - /my-ip supprimé (temporaire Tranzila, plus nécessaire)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

const { startCleanupScheduler } = require('./src/services/cleanupService');

const app = express();

// Render est derrière un proxy → nécessaire pour que le rate limiter
// voie la vraie IP client et pas celle du proxy
app.set('trust proxy', 1);

// ── Sécurité ──────────────────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limit global : 300 requêtes / 15 min / IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes, réessayez plus tard' },
});
app.use('/api', globalLimiter);

// Rate limit strict sur l'auth : 15 tentatives / 15 min / IP (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives, réessayez dans 15 minutes' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

app.use(express.json());

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// ── Page de test paiement Tranzila : JAMAIS en production ─────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use('/payment-test', require('./routes/paymentTest'));
}

const connectDB = require('./config/db');
connectDB();

mongoose.connection.once('open', () => {
  console.log('✅ MongoDB connecté');
  startCleanupScheduler();
});

const authRoutes           = require('./routes/authRoutes');
const userRoutes           = require('./routes/userRoutes');
const providerRoutes       = require('./routes/providerRoutes');
const publicProviderRoutes = require('./routes/publicProviderRoutes');
const bookingRoutes        = require('./routes/bookingRoutes');
const notificationRoutes   = require('./routes/notificationRoutes');

app.use('/api/public/providers', publicProviderRoutes);
app.use('/api/auth',             authRoutes);
app.use('/api/users',            userRoutes);
app.use('/api/providers',        providerRoutes);
app.use('/api/bookings',         bookingRoutes);
app.use('/api/notifications',    notificationRoutes);

app.get('/', (req, res) => {
  res.send('API CleanConnect est en ligne');
});

// ✅ FIX — 404 doit appeler next() pour que l'error handler global le reçoive
const ErrorResponse = require('./utils/errorResponse');
app.use((req, res, next) => {
  next(new ErrorResponse(`Route non trouvée : ${req.originalUrl}`, 404));
});

// ✅ Error handler global (toujours en dernier)
const errorHandler = require('./middleware/error');
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

module.exports = app;