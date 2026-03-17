// controllers/userController.js
// ✅ Contrôleur pour gérer les profils utilisateurs + vidéos de propriété + NOTIFICATIONS

const User = require('../models/User');
const Provider = require('../models/Provider'); // ✅ NOUVEAU
const Request = require('../models/Request');
const PaymentService = require('../src/services/paymentService');
const cloudinary = require('../config/cloudinary');
const notificationService = require('../src/services/notificationService');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private (client only)
exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Erreur getUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private (client only)
exports.updateUserProfile = async (req, res, next) => {
  try {
    console.log('📝 Mise à jour du profil utilisateur:', req.user.id);
    console.log('📦 Données reçues:', req.body);

    const allowedFields = ['firstName', 'lastName', 'phone', 'address', 'city'];
    
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    console.log('✅ Champs à mettre à jour:', updateData);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      {
        new: true,
        runValidators: true,
        select: '-password'
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    console.log('✅ Profil mis à jour:', user);

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: user
    });
  } catch (error) {
    console.error('❌ Erreur updateUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
      error: error.message
    });
  }
};

// @desc    Add user address
// @route   POST /api/users/addresses
// @access  Private (client only)
exports.addAddress = async (req, res, next) => {
  try {
    const { name, street, city, country, additionalInfo } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (!user.addresses) {
      user.addresses = [];
    }

    user.addresses.push({
      name,
      street,
      city,
      country,
      additionalInfo
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Adresse ajoutée avec succès',
      data: user.addresses
    });
  } catch (error) {
    console.error('Erreur addAddress:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de l\'adresse'
    });
  }
};

// @desc    Update user address
// @route   PUT /api/users/addresses/:id
// @access  Private (client only)
exports.updateAddress = async (req, res, next) => {
  try {
    const { name, street, city, country, additionalInfo } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const address = user.addresses.id(req.params.id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Adresse non trouvée'
      });
    }

    if (name) address.name = name;
    if (street) address.street = street;
    if (city) address.city = city;
    if (country) address.country = country;
    if (additionalInfo !== undefined) address.additionalInfo = additionalInfo;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Adresse mise à jour avec succès',
      data: user.addresses
    });
  } catch (error) {
    console.error('Erreur updateAddress:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'adresse'
    });
  }
};

// @desc    Delete user address
// @route   DELETE /api/users/addresses/:id
// @access  Private (client only)
exports.deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    user.addresses.pull(req.params.id);

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Adresse supprimée avec succès',
      data: user.addresses
    });
  } catch (error) {
    console.error('Erreur deleteAddress:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'adresse'
    });
  }
};

// ============================================
// ✅ GESTION VIDÉO DE PROPRIÉTÉ
// ============================================

// @desc    Upload property video
// @route   POST /api/users/property-video
// @access  Private (Client only)
exports.uploadPropertyVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Aucun fichier vidéo fourni' 
      });
    }

    console.log('📹 Upload vidéo de propriété pour:', req.user.id);
    console.log('   Taille fichier:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Utilisateur non trouvé' 
      });
    }

    if (user.propertyVideo?.publicId) {
      try {
        console.log('🗑️ Suppression ancienne vidéo:', user.propertyVideo.publicId);
        await cloudinary.uploader.destroy(user.propertyVideo.publicId, { 
          resource_type: 'video' 
        });
      } catch (error) {
        console.error('⚠️ Erreur suppression ancienne vidéo:', error);
      }
    }

    console.log('☁️ Upload vers Cloudinary...');
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'cleanconnect/property_videos',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const result = await uploadPromise;

    user.propertyVideo = {
      url: result.secure_url,
      publicId: result.public_id,
      uploadedAt: new Date()
    };
    await user.save();

    console.log('✅ Vidéo uploadée:', result.secure_url);

    res.status(200).json({ 
      success: true,
      message: 'Vidéo uploadée avec succès',
      video: user.propertyVideo 
    });

  } catch (error) {
    console.error('❌ Erreur upload vidéo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de l\'upload de la vidéo',
      error: error.message 
    });
  }
};

// @desc    Get property video
// @route   GET /api/users/property-video
// @access  Private (Client only)
exports.getPropertyVideo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Utilisateur non trouvé' 
      });
    }

    res.status(200).json({ 
      success: true,
      video: user.propertyVideo || null 
    });

  } catch (error) {
    console.error('❌ Erreur récupération vidéo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération de la vidéo' 
    });
  }
};

// @desc    Delete property video
// @route   DELETE /api/users/property-video
// @access  Private (Client only)
exports.deletePropertyVideo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Utilisateur non trouvé' 
      });
    }

    if (user.propertyVideo?.publicId) {
      try {
        console.log('🗑️ Suppression vidéo Cloudinary:', user.propertyVideo.publicId);
        await cloudinary.uploader.destroy(user.propertyVideo.publicId, { 
          resource_type: 'video' 
        });
      } catch (error) {
        console.error('⚠️ Erreur suppression Cloudinary:', error);
      }
    }

    user.propertyVideo = undefined;
    await user.save();

    console.log('✅ Vidéo supprimée du profil');

    res.status(200).json({ 
      success: true,
      message: 'Vidéo supprimée avec succès' 
    });

  } catch (error) {
    console.error('❌ Erreur suppression vidéo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la suppression de la vidéo' 
    });
  }
};

// ============================================
// GESTION DES RÉSERVATIONS AVEC NOTIFICATIONS
// ============================================

// ✅ ESCROW - Créer une réservation avec paiement + NOTIFICATION
// @desc    Create booking with payment
// @route   POST /api/bookings
// @access  Private (client only)
exports.createBooking = async (req, res, next) => {
  try {
    console.log('📝 Création d\'une réservation...');
    console.log('   Client ID:', req.user.id);
    console.log('   Données:', JSON.stringify(req.body, null, 2));
    
    const {
      providerId,
      serviceType,
      propertyType,
      scheduledDate,
      address,
      description,
      price,
      duration,
      paymentIntentId
    } = req.body;
    
    // Validation
    if (!providerId || !serviceType || !scheduledDate || !price) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis manquants'
      });
    }
    
    // ✅ Récupérer la vidéo du client ET le prestataire
    const client = await User.findById(req.user.id);
    const provider = await Provider.findById(providerId);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Prestataire non trouvé'
      });
    }
    
    // Calculer les frais de plateforme
    const fees = PaymentService.calculatePlatformFee(price);
    
    // Créer le payment intent si pas déjà fourni
    let finalPaymentIntentId = paymentIntentId;
    
    if (!finalPaymentIntentId) {
      console.log('💳 Création du payment intent...');
      const paymentResult = await PaymentService.createPaymentIntent({
        amount: fees.totalFee,
        currency: 'ILS',
        metadata: {
          clientId: req.user.id,
          providerId: providerId,
          serviceType: serviceType,
          servicePrice: price
        }
      });
      
      if (!paymentResult.success) {
        return res.status(400).json({
          success: false,
          message: paymentResult.message || 'Échec de création du paiement'
        });
      }
      
      finalPaymentIntentId = paymentResult.paymentIntent.id;
    }
    
    // Créer la demande/réservation
    const request = await Request.create({
      client: req.user.id,
      provider: providerId,
      serviceType,
      propertyType: propertyType || 'appartement',
      status: 'pending_payment',
      scheduledDate: new Date(scheduledDate),
      address: address || 'À définir',
      description: description || '',
      price: price,
      propertyVideoUrl: client.propertyVideo?.url || null,
      payment: {
        intentId: finalPaymentIntentId,
        status: 'held',
        amount: fees.totalFee,
        paidAt: new Date()
      },
      providerPhoneVisible: false
    });
    
    // Peupler les données du provider
    await request.populate('provider', 'firstName lastName phone email');
    
    console.log('✅ Réservation créée:', request._id);
    if (client.propertyVideo?.url) {
      console.log('📹 Vidéo attachée:', client.propertyVideo.url);
    }
    
    // ✅ NOUVEAU : Envoyer la notification au prestataire
    if (provider.pushToken) {
      console.log('📤 Envoi notification au prestataire...');
      
      const clientName = `${client.firstName} ${client.lastName}`;
      
      await notificationService.notifyProviderNewBooking(provider.pushToken, {
        bookingId: request._id.toString(),
        clientId: client._id.toString(),
        clientName: clientName,
        serviceType: serviceType,
        scheduledDate: scheduledDate,
        price: price
      });
    } else {
      console.log('⚠️ Prestataire sans push token');
    }
    
    res.status(201).json({
      success: true,
      message: 'Réservation créée avec succès',
      booking: request
    });
    
  } catch (error) {
    console.error('❌ Erreur createBooking:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réservation',
      error: error.message
    });
  }
};

// @desc    Get user bookings
// @route   GET /api/bookings
// @access  Private (client only)
exports.getUserBookings = async (req, res, next) => {
  try {
    console.log('📋 Récupération des réservations pour:', req.user.id);
    
    const bookings = await Request.find({ client: req.user.id })
      .populate('provider', 'firstName lastName phone email rating hourlyRate')
      .sort({ createdAt: -1 });
    
    console.log(`✅ ${bookings.length} réservations trouvées`);
    
    const formattedBookings = bookings.map(request => ({
      _id: request._id,
      serviceType: request.serviceType,
      dateTime: request.scheduledDate,
      duration: request.duration,
      frequency: 'one_time',
      price: request.price,
      status: request.status,
      selectedProvider: {
        _id: request.provider._id,
        name: `${request.provider.firstName} ${request.provider.lastName}`,
        phone: request.provider.phone,
        rating: request.provider.rating || 4.8,
        hourlyRate: request.provider.hourlyRate || 0
      },
      address: {
        fullAddress: request.address
      },
      notes: request.description,
      created: request.createdAt,
      payment: request.payment,
      providerPhoneVisible: request.providerPhoneVisible,
      propertyVideoUrl: request.propertyVideoUrl
    }));
    
    res.status(200).json({
      success: true,
      count: formattedBookings.length,
      data: formattedBookings
    });
    
  } catch (error) {
    console.error('❌ Erreur getUserBookings:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations'
    });
  }
};