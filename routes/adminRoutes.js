// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminAuth');
const { getStats } = require('../controllers/adminController');

router.get('/stats', protectAdmin, getStats);

module.exports = router;
