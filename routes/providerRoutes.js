// routes/providerRoutes.js
// ✅ AVEC LA ROUTE GET /providers AJOUTÉE

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const providerController = require('../controllers/providerController');

// ✅ NOUVELLE ROUTE - Récupérer tous les prestataires (PUBLIC - pas besoin d'auth)
router.get('/', providerController.getAllProviders);

// Routes du profil prestataire
router.get('/profile', protect, authorize('provider'), providerController.getProviderProfile);
router.put('/profile', protect, authorize('provider'), providerController.updateProviderProfile);

// Routes pour les disponibilités
router.put('/availability', protect, authorize('provider'), providerController.updateAvailability);

// ✅ Routes pour gérer les services
router.post('/services', protect, authorize('provider'), providerController.addService);
router.put('/services/:id', protect, authorize('provider'), providerController.updateService);
router.delete('/services/:id', protect, authorize('provider'), providerController.deleteService);

// ✅ Routes optimisées pour le dashboard
router.get('/dashboard/stats', protect, authorize('provider'), providerController.getDashboardStats);
router.get('/dashboard/today', protect, authorize('provider'), providerController.getTodayJobs);

// Routes pour les missions
router.get('/jobs', protect, authorize('provider'), providerController.getJobs);
router.get('/jobs/:id', protect, authorize('provider'), providerController.getJob);
router.put('/jobs/:id/accept', protect, authorize('provider'), providerController.acceptJob);
router.put('/jobs/:id/decline', protect, authorize('provider'), providerController.declineJob);
router.put('/jobs/:id/complete', protect, authorize('provider'), providerController.completeJob);

module.exports = router;