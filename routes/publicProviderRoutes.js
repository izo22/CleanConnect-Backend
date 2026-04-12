// routes/publicProviderRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const publicProviderController = require('../controllers/publicProviderController');

router.get('/', publicProviderController.getProviders);
router.get('/:id', publicProviderController.getProviderDetails);

// ✅ NOUVEAU : créneaux déjà réservés (pour bloquer côté client)
router.get('/:id/bookings', publicProviderController.getProviderBookings);

// Avis
router.post('/:id/reviews', protect, authorize('client'), publicProviderController.submitReview);

module.exports = router;