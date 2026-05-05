// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { startCleanupScheduler } = require('./src/services/cleanupService');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});
app.use('/payment-test', require('./routes/paymentTest'));

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

app.use('/api/public/providers', publicProviderRoutes);
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/bookings',  bookingRoutes);

app.get('/', (req, res) => {
  res.send('API CleanConnect est en ligne');
});

// ✅ TEMPORAIRE — Récupérer l'IP publique de Render pour whitelist Tranzila
app.get('/my-ip', async (req, res) => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    console.log('🌐 IP publique Render:', data.ip);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Impossible de récupérer l\'IP' });
  }
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
