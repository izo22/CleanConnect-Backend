// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  getUserProfile,
  updateUserProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  uploadPropertyVideo,
  getPropertyVideo,
  deletePropertyVideo
} = require('../controllers/userController');

// Configuration multer pour l'upload de vidéos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter seulement les vidéos
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Le fichier doit être une vidéo'), false);
    }
  }
});

// Routes du profil
router.get('/profile', protect, authorize('client'), getUserProfile);
router.put('/profile', protect, authorize('client'), updateUserProfile);

// Routes pour les adresses
router.post('/addresses', protect, authorize('client'), addAddress);
router.put('/addresses/:id', protect, authorize('client'), updateAddress);
router.delete('/addresses/:id', protect, authorize('client'), deleteAddress);

// ✅ NOUVEAU : Routes pour la vidéo de propriété
router.post('/property-video', protect, authorize('client'), upload.single('video'), uploadPropertyVideo);
router.get('/property-video', protect, authorize('client'), getPropertyVideo);
router.delete('/property-video', protect, authorize('client'), deletePropertyVideo);

module.exports = router;