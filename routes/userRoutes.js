// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Routes temporaires
router.get('/profile', protect, authorize('client'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Profil utilisateur récupéré',
    data: req.user
  });
});

router.put('/profile', protect, authorize('client'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Profil utilisateur mis à jour'
  });
});

// Routes pour les adresses
router.post('/addresses', protect, authorize('client'), (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Adresse ajoutée'
  });
});

router.put('/addresses/:id', protect, authorize('client'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Adresse mise à jour'
  });
});

router.delete('/addresses/:id', protect, authorize('client'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Adresse supprimée'
  });
});

module.exports = router;