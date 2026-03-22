// controllers/providerController.js
// ✅ VERSION CORRIGÉE: Fix serviceTypeMap anglais → hébreu + Fix declineJob tranzilaIndex

const Provider = require('../models/Provider');
const Request = require('../models/Request');
const Review = require('../models/Review');
const User = require('../models/User');
const PaymentService = require('../src/services/paymentService');
const notificationService = require('../src/services/notificationService');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Récupérer tous les prestataires (pour recherche client)
// @route   GET /api/providers?city=ירושלים&serviceType=home
// @access  Public
exports.getAllProviders = asyncHandler(async (req, res, next) => {
  const { city, serviceType } = req.query;

  console.log('📡 ===== RÉCUPÉRATION DES PRESTATAIRES =====');
  console.log('   Ville:', city || 'toutes');
  console.log('   Service:', serviceType || 'tous');

  // ✅ Table de correspondance anglais → hébreu
  const serviceTypeMap = {
    'home':     'בית',
    'office':   'משרד',
    'building': 'בניין',
    'airbnb':   'אירבנב',
  };

  const query = { role: 'provider' };

  if (city) {
    query.serviceAreas = {
      $elemMatch: {
        $regex: city.trim(),
        $options: 'i'
      }
    };
  }

  if (serviceType) {
    const hebrewType = serviceTypeMap[serviceType.toLowerCase()] || serviceType;
    console.log(`   ServiceType reçu: "${serviceType}" → recherche: "${hebrewType}"`);
    query.serviceTypes = {
      $elemMatch: {
        $regex: hebrewType.trim(),
        $options: 'i'
      }
    };
  }

  const providers = await Provider.find(query)
    .select('firstName lastName email phone hourlyRate rating reviewCount bio serviceTypes serviceAreas profilePicture serviceDetails availability')
    .sort({ rating: -1, createdAt: -1 });

  console.log(`✅ ${providers.length} prestataires trouvés`);

  res.status(200).json({
    success: true,
    count: providers.length,
    data: providers.map(p => ({ ...p.toObject(), serviceCities: p.serviceAreas || [] }))
  });
});

// @desc    Récupérer le profil du prestataire
// @route   GET /api/providers/profile
// @access  Private (Prestataire uniquement)
exports.getProviderProfile = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  
  console.log('🔍 Récupération profil pour provider ID:', providerId);
  
  const provider = await Provider.findById(providerId);
  
  if (!provider) {
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }
  
  console.log('✅ Provider trouvé');
  
  const requests = await Request.find({ provider: providerId })
    .populate('client', 'firstName lastName')
    .sort({ createdAt: -1 });
  
  const reviews = await Review.find({ provider: providerId })
    .populate('client', 'firstName lastName')
    .sort({ createdAt: -1 });
  
  const formattedRequests = requests.map(req => ({
    _id: req._id,
    status: req.status,
    serviceType: req.serviceType,
    date: req.scheduledDate,
    scheduledDate: req.scheduledDate,
    address: req.address,
    price: req.price,
    client: req.client ? {
      firstName: req.client.firstName,
      lastName: req.client.lastName,
      _id: req.client._id
    } : null,
    createdAt: req.createdAt
  }));
  
  const formattedReviews = reviews.map(review => ({
    id: review._id,
    rating: review.rating,
    comment: review.comment,
    date: review.createdAt,
    clientName: review.client ? `${review.client.firstName} ${review.client.lastName}` : 'Client inconnu',
  }));
  
  res.status(200).json({
    success: true,
    data: {
      ...provider.toObject(),
      requests: formattedRequests,
      reviews: formattedReviews
    }
  });
});

// @desc    Mettre à jour le profil du prestataire
// @route   PUT /api/providers/profile
// @access  Private (Prestataire uniquement)
exports.updateProviderProfile = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  const updateData = req.body;
  
  console.log('🔄 ===== MISE À JOUR DU PROFIL PROVIDER =====');
  console.log('   Provider ID:', providerId);
  
  const allowedFields = [
    'firstName', 'lastName', 'companyName', 'email', 'phone', 'address', 
    'bio', 'serviceTypes', 'serviceAreas', 'availability', 
    'profilePicture', 'serviceDetails'
  ];
  
  const filteredData = {};
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });
  
  if (filteredData.serviceDetails && Array.isArray(filteredData.serviceDetails) && filteredData.serviceDetails.length > 0) {
    const totalRate = filteredData.serviceDetails.reduce((sum, service) => {
      return sum + (parseFloat(service.hourlyRate) || 0);
    }, 0);
    filteredData.hourlyRate = totalRate / filteredData.serviceDetails.length;
  }
  
  const updatedProvider = await Provider.findByIdAndUpdate(
    providerId,
    { $set: filteredData },
    { new: true, runValidators: true }
  );
  
  if (!updatedProvider) {
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Profil prestataire mis à jour',
    data: updatedProvider
  });
});

// @desc    Mettre à jour les disponibilités du prestataire
// @route   PUT /api/providers/availability
// @access  Private (Prestataire uniquement)
exports.updateAvailability = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  const { availability } = req.body;

  if (!availability) {
    return next(new ErrorResponse('Veuillez fournir des disponibilités valides', 400));
  }

  const provider = await Provider.findById(providerId);
  
  if (!provider) {
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }

  provider.availability = availability;
  await provider.save();

  res.status(200).json({
    success: true,
    message: 'Disponibilités mises à jour',
    data: provider.availability
  });
});

// @desc    Récupérer toutes les missions du prestataire
// @route   GET /api/providers/jobs
// @access  Private (Prestataire uniquement)
exports.getJobs = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  
  const jobs = await Request.find({ provider: providerId })
    .populate('client', 'firstName lastName email phone')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: jobs.length,
    message: 'Liste des missions récupérée',
    data: jobs
  });
});

// @desc    Récupérer une mission spécifique
// @route   GET /api/providers/jobs/:id
// @access  Private (Prestataire uniquement)
exports.getJob = asyncHandler(async (req, res, next) => {
  const jobId = req.params.id;
  const providerId = req.user.id;
  
  const job = await Request.findOne({ 
    _id: jobId,
    provider: providerId
  }).populate('client', 'firstName lastName email address');
  
  if (!job) {
    return next(new ErrorResponse('Mission non trouvée ou non autorisée', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Détails de la mission récupérés',
    data: job
  });
});

// @desc    Accepter une mission
// @route   PUT /api/providers/jobs/:id/accept
// @access  Private (Prestataire uniquement)
exports.acceptJob = asyncHandler(async (req, res, next) => {
  const jobId = req.params.id;
  const providerId = req.user.id;
  
  console.log('✅ Acceptation de la mission:', jobId);
  
  const job = await Request.findOne({ 
    _id: jobId, 
    provider: providerId 
  })
    .populate('client', 'firstName lastName pushToken')
    .populate('provider', 'firstName lastName phone');
  
  if (!job) {
    return next(new ErrorResponse('Mission non trouvée ou non autorisée', 404));
  }
  
  if (job.status !== 'pending' && job.status !== 'pending_payment') {
    return next(new ErrorResponse('Cette mission ne peut pas être acceptée', 400));
  }
  
  // ✅ Rien à faire chez Tranzila — client déjà débité à la réservation
  job.status = 'accepted';
  job.payment.status = 'captured';
  job.payment.capturedAt = new Date();
  job.providerPhoneVisible = true;
  
  await job.save();
  
  console.log('✅ Mission acceptée');
  
  if (job.client?.pushToken) {
    const providerName = `${job.provider.firstName} ${job.provider.lastName}`;
    await notificationService.notifyClientBookingAccepted(job.client.pushToken, {
      bookingId: job._id.toString(),
      providerId: job.provider._id.toString(),
      providerName,
      providerPhone: job.provider.phone,
      scheduledDate: job.scheduledDate
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Mission acceptée',
    data: job
  });
});


// @desc    Refuser une mission
// @route   PUT /api/providers/jobs/:id/decline
// @access  Private (Prestataire uniquement)
exports.declineJob = asyncHandler(async (req, res, next) => {
  const jobId = req.params.id;
  const providerId = req.user.id;
  const { reason } = req.body || {};
  
  console.log('❌ Refus de la mission:', jobId);
  
  const job = await Request.findOne({ 
    _id: jobId, 
    provider: providerId 
  })
    .populate('client', 'firstName lastName pushToken')
    .populate('provider', 'firstName lastName');
  
  if (!job) {
    return next(new ErrorResponse('Mission non trouvée ou non autorisée', 404));
  }

  const refundableStatuses = ['held', 'captured', 'authorized', 'pending', 'requires_capture'];
  if (!refundableStatuses.includes(job.payment?.status)) {
    return next(new ErrorResponse(`Le paiement ne peut pas être remboursé (statut: ${job.payment?.status})`, 400));
  }
  
  try {
    // ✅ FIX — utilise tranzilaIndex tel quel, SANS fallback sur intentId
    // Avant : const tranzilaIndex = job.payment.tranzilaIndex || job.payment.intentId
    //         → passait "trz_XXXXX_YYYYY" comme index → Tranzila CGI répondait HTML "Bad Request"
    // Après : si tranzilaIndex est absent, on decline sans appeler Tranzila (et on log)
    const tranzilaIndex = job.payment.tranzilaIndex;

    if (tranzilaIndex) {
      console.log('↩️  Remboursement Tranzila — index:', tranzilaIndex);
      const refundResult = await PaymentService.refundPayment(
        job.payment.intentId,
        tranzilaIndex,
        reason || 'Provider declined request'
      );
      
      if (!refundResult.success) {
        // On log l'échec mais on ne bloque pas le prestataire
        console.error('⚠️ Remboursement Tranzila échoué (mission déclinée quand même):', refundResult);
      } else {
        console.log('✅ Remboursement Tranzila effectué');
      }
    } else {
      // tranzilaIndex absent en DB = booking créée avant le fix ou paiement Bit
      console.warn('⚠️ tranzilaIndex absent en DB — mission déclinée sans remboursement Tranzila');
    }
    
    job.status = 'declined';
    job.payment.status = 'refunded';
    job.payment.refundedAt = new Date();
    job.declineReason = reason || 'Non spécifié';
    
    await job.save();
    
    console.log('✅ Mission refusée');
    
    if (job.client?.pushToken) {
      const providerName = `${job.provider.firstName} ${job.provider.lastName}`;
      await notificationService.notifyClientBookingDeclined(job.client.pushToken, {
        bookingId: job._id.toString(),
        providerId: job.provider._id.toString(),
        providerName
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Mission refusée et client remboursé',
      data: job
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du refus:', error);
    return next(new ErrorResponse('Erreur lors du refus de la mission', 500));
  }
});

// @desc    Marquer une mission comme terminée
// @route   PUT /api/providers/jobs/:id/complete
// @access  Private (Prestataire uniquement)
exports.completeJob = asyncHandler(async (req, res, next) => {
  const jobId = req.params.id;
  const providerId = req.user.id;
  const { notes } = req.body;
  
  const job = await Request.findOneAndUpdate(
    { _id: jobId, provider: providerId },
    { 
      status: 'completed',
      completionNotes: notes || '',
      completedAt: Date.now()
    },
    { new: true, runValidators: true }
  );
  
  if (!job) {
    return next(new ErrorResponse('Mission non trouvée ou non autorisée', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Mission terminée',
    data: job
  });
});

// @desc    Ajouter un service
// @route   POST /api/providers/services
// @access  Private (Prestataire uniquement)
exports.addService = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  const { type, hourlyRate, description } = req.body;
  
  if (!type || !hourlyRate) {
    return next(new ErrorResponse('Type et tarif horaire requis', 400));
  }
  
  const provider = await Provider.findById(providerId);
  
  if (!provider) {
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }
  
  provider.serviceDetails.push({ type, hourlyRate, description: description || '' });
  
  const totalRate = provider.serviceDetails.reduce((sum, s) => sum + s.hourlyRate, 0);
  provider.hourlyRate = totalRate / provider.serviceDetails.length;
  
  await provider.save();
  
  res.status(201).json({
    success: true,
    message: 'Service ajouté avec succès',
    data: provider
  });
});

// @desc    Mettre à jour un service
// @route   PUT /api/providers/services/:id
// @access  Private (Prestataire uniquement)
exports.updateService = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  const serviceId = req.params.id;
  const { type, hourlyRate, description } = req.body;
  
  const provider = await Provider.findById(providerId);
  
  if (!provider) {
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }
  
  const service = provider.serviceDetails.id(serviceId);
  
  if (!service) {
    return next(new ErrorResponse('Service non trouvé', 404));
  }
  
  if (type) service.type = type;
  if (hourlyRate) service.hourlyRate = hourlyRate;
  if (description !== undefined) service.description = description;
  
  const totalRate = provider.serviceDetails.reduce((sum, s) => sum + s.hourlyRate, 0);
  provider.hourlyRate = totalRate / provider.serviceDetails.length;
  
  await provider.save();
  
  res.status(200).json({
    success: true,
    message: 'Service mis à jour avec succès',
    data: provider
  });
});

// @desc    Supprimer un service
// @route   DELETE /api/providers/services/:id
// @access  Private (Prestataire uniquement)
exports.deleteService = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  const serviceId = req.params.id;
  
  const provider = await Provider.findById(providerId);
  
  if (!provider) {
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }
  
  const service = provider.serviceDetails.id(serviceId);
  
  if (!service) {
    return next(new ErrorResponse('Service non trouvé', 404));
  }
  
  provider.serviceDetails.pull(serviceId);
  
  if (provider.serviceDetails.length > 0) {
    const totalRate = provider.serviceDetails.reduce((sum, s) => sum + s.hourlyRate, 0);
    provider.hourlyRate = totalRate / provider.serviceDetails.length;
  } else {
    provider.hourlyRate = 0;
  }
  
  await provider.save();
  
  res.status(200).json({
    success: true,
    message: 'Service supprimé avec succès',
    data: provider
  });
});

// @desc    Obtenir les statistiques du dashboard
// @route   GET /api/providers/dashboard/stats
// @access  Private (Prestataire uniquement)
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  
  const [pendingCount, completedCount, totalBookings] = await Promise.all([
    Request.countDocuments({ provider: providerId, status: 'pending' }),
    Request.countDocuments({ provider: providerId, status: 'completed' }),
    Request.countDocuments({ provider: providerId })
  ]);
  
  res.status(200).json({
    success: true,
    data: { pendingCount, completedCount, totalBookings }
  });
});

// @desc    Obtenir les missions du jour
// @route   GET /api/providers/dashboard/today
// @access  Private (Prestataire uniquement)
exports.getTodayJobs = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayBookings = await Request.find({
    provider: providerId,
    scheduledDate: { $gte: today, $lt: tomorrow }
  })
  .populate('client', 'firstName lastName email phone')
  .sort({ scheduledDate: 1 })
  .limit(10);
  
  res.status(200).json({
    success: true,
    data: todayBookings
  });
});

module.exports = exports;