// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  registerClient,
  registerProvider,
  login,
  getMe
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Routes d'enregistrement
router.post('/register/client', registerClient);
router.post('/register/provider', registerProvider);

// Route de connexion
router.post('/login', login);

// Route pour obtenir l'utilisateur actuel
router.get('/me', protect, getMe);

module.exports = router;