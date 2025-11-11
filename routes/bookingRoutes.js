// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Routes temporaires
router.get('/search-providers', protect, authorize('client'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Liste des prestataires disponibles',
    data: []
  });
});

router.post('/', protect, authorize('client'), (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Réservation créée',
    data: {
      id: 'temp-booking-id',
      status: 'pending'
    }
  });
});

router.get('/:id', protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Détails de la réservation récupérés',
    data: {
      id: req.params.id,
      status: 'pending'
    }
  });
});

router.get('/client', protect, authorize('client'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Liste des réservations du client récupérée',
    data: []
  });
});

router.put('/:id/cancel', protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Réservation annulée'
  });
});

router.post('/:id/review', protect, authorize('client'), (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Avis ajouté'
  });
});

module.exports = router;