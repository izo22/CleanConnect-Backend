// controllers/providerController.js
const Provider = require('../models/Provider');
const Request = require('../models/Request');
const Review = require('../models/Review');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// ✅ FONCTION CORRIGÉE
// @desc    Récupérer tous les prestataires (pour recherche client)
// @route   GET /api/providers
// @access  Public
exports.getAllProviders = asyncHandler(async (req, res, next) => {
  console.log('📡 Récupération de tous les prestataires...');
  
  // ✅ CORRECTION : Utiliser 'role' au lieu de 'userType'
  const providers = await Provider.find({ role: 'provider' })
    .select('firstName lastName email phone hourlyRate rating reviewCount bio serviceTypes serviceAreas profilePicture')
    .sort({ rating: -1, createdAt: -1 }); // Trier par note puis par date
  
  console.log('🔍 Premier prestataire BRUT:', JSON.stringify(providers[0], null, 2));
  
  // 🔄 Mapper serviceAreas → serviceCities pour le frontend
  const mappedProviders = providers.map(provider => ({
    ...provider.toObject(),
    serviceCities: provider.serviceAreas, // ← Ajouter serviceCities
  }));
  
  console.log('🔍 Premier prestataire MAPPÉ:', JSON.stringify(mappedProviders[0], null, 2));
  console.log(`✅ ${mappedProviders.length} prestataires trouvés`);
  
  res.status(200).json({
    success: true,
    count: mappedProviders.length,
    data: mappedProviders
  });
});

// @desc    Récupérer le profil du prestataire
// @route   GET /api/providers/profile
// @access  Private (Prestataire uniquement)
exports.getProviderProfile = asyncHandler(async (req, res, next) => {
  // Le middleware d'authentification a déjà ajouté l'utilisateur à req.user
  const providerId = req.user.id;
  
  console.log('🔍 Récupération profil pour provider ID:', providerId);
  
  // Trouver le prestataire et ses données associées
  const provider = await Provider.findById(providerId);
  
  if (!provider) {
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }
  
  console.log('✅ Provider trouvé - Availability:', JSON.stringify(provider.availability, null, 2));
  
  // Récupérer les demandes associées à ce prestataire
  const requests = await Request.find({ provider: providerId })
    .populate('client', 'firstName lastName')
    .sort({ createdAt: -1 });
  
  // Récupérer les avis associés à ce prestataire
  const reviews = await Review.find({ provider: providerId })
    .populate('client', 'firstName lastName')
    .sort({ createdAt: -1 });
  
  // Construire l'objet de réponse
  const formattedRequests = requests.map(req => ({
    id: req._id,
    status: req.status,
    serviceType: req.serviceType,
    date: req.scheduledDate,
    clientName: req.client ? `${req.client.firstName} ${req.client.lastName}` : 'Client inconnu',
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
  
  // Validation des données (à adapter selon votre modèle)
  const allowedFields = [
    'firstName', 'lastName', 'companyName', 'phone', 'address', 
    'bio', 'services', 'serviceAreas', 'availability', 'profilePicture'
  ];
  
  // Filtrer les champs autorisés
  const filteredData = {};
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });
  
  // Mise à jour du profil
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

// ✅ SOLUTION 1 : FONCTION CORRIGÉE
// @desc    Mettre à jour les disponibilités du prestataire
// @route   PUT /api/providers/availability
// @access  Private (Prestataire uniquement)
exports.updateAvailability = asyncHandler(async (req, res, next) => {
  const providerId = req.user.id;
  const { availability } = req.body;

  console.log('📅 Mise à jour disponibilités pour provider:', providerId);
  console.log('📅 Données reçues:', JSON.stringify(availability, null, 2));

  if (!availability) {
    return next(new ErrorResponse('Veuillez fournir des disponibilités valides', 400));
  }

  // ✅ CORRECTION : Utiliser findById + save() au lieu de findByIdAndUpdate
  const provider = await Provider.findById(providerId);
  
  if (!provider) {
    console.log('❌ Provider non trouvé avec ID:', providerId);
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }

  console.log('✅ Provider trouvé, anciennes disponibilités:', JSON.stringify(provider.availability, null, 2));

  // Mettre à jour les disponibilités
  provider.availability = availability;
  
  // Sauvegarder avec save() pour garantir la persistance
  await provider.save();

  console.log('✅ Disponibilités sauvegardées en base:', JSON.stringify(provider.availability, null, 2));

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
  }).populate('client', 'firstName lastName email phone address');
  
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
  
  const job = await Request.findOneAndUpdate(
    { _id: jobId, provider: providerId },
    { status: 'accepted' },
    { new: true, runValidators: true }
  );
  
  if (!job) {
    return next(new ErrorResponse('Mission non trouvée ou non autorisée', 404));
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
  const { reason } = req.body;
  
  const job = await Request.findOneAndUpdate(
    { _id: jobId, provider: providerId },
    { 
      status: 'declined',
      declineReason: reason || 'Non spécifié'
    },
    { new: true, runValidators: true }
  );
  
  if (!job) {
    return next(new ErrorResponse('Mission non trouvée ou non autorisée', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Mission refusée',
    data: job
  });
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

module.exports = exports;
