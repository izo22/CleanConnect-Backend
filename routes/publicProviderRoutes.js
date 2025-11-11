// routes/publicProviderRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const publicProviderController = require('../controllers/publicProviderController');

// Routes publiques pour récupérer des informations sur les prestataires
router.get('/', publicProviderController.getProviders);
router.get('/:id', publicProviderController.getProviderDetails);

// Route pour soumettre un avis (nécessite une authentification client)
router.post('/:id/reviews', protect, authorize('client'), publicProviderController.submitReview);

module.exports = router;