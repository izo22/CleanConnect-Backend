// server.js - Version corrigée
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Initialiser l'application Express
const app = express();

// Middleware
app.use(cors({
  origin: '*', // En développement, permet toutes les origines
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Connexion à la base de données
const connectDB = require('./config/db');
connectDB();

// Importer les routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const providerRoutes = require('./routes/providerRoutes');
const publicProviderRoutes = require('./routes/publicProviderRoutes'); // AJOUT
const bookingRoutes = require('./routes/bookingRoutes');

// Utiliser les routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/public/providers', publicProviderRoutes); // AJOUT
app.use('/api/bookings', bookingRoutes);

// Route de base
app.get('/', (req, res) => {
  res.send('API CleanConnect est en ligne');
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Port du serveur
const PORT = process.env.PORT || 5000;

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

module.exports = app;