// routes/notificationRoutes.js
// ✅ Routes pour gérer les notifications push

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { savePushToken, removePushToken } = require('../controllers/notificationController');

// Routes pour gérer le push token
router.post('/token', protect, savePushToken);
router.delete('/token', protect, removePushToken);

module.exports = router;