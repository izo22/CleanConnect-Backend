// server.js - Version avec nettoyage automatique et logs
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// ✅ NOUVEAU: Importer le service de nettoyage
const { startCleanupScheduler } = require('./src/services/cleanupService');

// Initialiser l'application Express
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// ✅ LOGS pour débugger les requêtes
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Connexion à la base de données
const connectDB = require('./config/db');
connectDB();

// ✅ Démarrer le scheduler après connexion DB
mongoose.connection.once('open', () => {
  console.log('✅ MongoDB connecté');
  startCleanupScheduler();
});

// Importer les routes
const authRoutes          = require('./routes/authRoutes');
const userRoutes          = require('./routes/userRoutes');
const providerRoutes      = require('./routes/providerRoutes');
const publicProviderRoutes = require('./routes/publicProviderRoutes');
const bookingRoutes       = require('./routes/bookingRoutes');

// Utiliser les routes
app.use('/api/public/providers', publicProviderRoutes);
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/bookings',  bookingRoutes);

// Route de base
app.get('/', (req, res) => {
  res.send('API CleanConnect est en ligne');
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée' });
});

// ✅ FIX — Error handler global (doit être en dernier)
// Remplace les réponses HTML d'Express par du JSON systématique
const errorHandler = require('./middleware/error');
app.use(errorHandler);

// Port du serveur
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

module.exports = app;