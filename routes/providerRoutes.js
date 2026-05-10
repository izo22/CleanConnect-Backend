// routes/providerRoutes.js — VERSION CORRIGÉE
// ✅ Ajout de la route PUT /service-areas

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const providerController = require('../controllers/providerController');

// PUBLIC
router.get('/', providerController.getAllProviders);

// Profil
router.get('/profile', protect, authorize('provider'), providerController.getProviderProfile);
router.put('/profile', protect, authorize('provider'), providerController.updateProviderProfile);

// Disponibilités
router.put('/availability', protect, authorize('provider'), providerController.updateAvailability);

// Services
router.post('/services', protect, authorize('provider'), providerController.addService);
router.put('/services/:id', protect, authorize('provider'), providerController.updateService);
router.delete('/services/:id', protect, authorize('provider'), providerController.deleteService);

// ✅ NOUVELLE ROUTE — Zones de service
router.put('/service-areas', protect, authorize('provider'), providerController.updateServiceAreas);

// Dashboard
router.get('/dashboard/stats', protect, authorize('provider'), providerController.getDashboardStats);
router.get('/dashboard/today', protect, authorize('provider'), providerController.getTodayJobs);

// Missions
router.get('/jobs', protect, authorize('provider'), providerController.getJobs);
router.get('/jobs/:id', protect, authorize('provider'), providerController.getJob);
router.put('/jobs/:id/accept', protect, authorize('provider'), providerController.acceptJob);
router.put('/jobs/:id/decline', protect, authorize('provider'), providerController.declineJob);
router.put('/jobs/:id/complete', protect, authorize('provider'), providerController.completeJob);

module.exports = router;