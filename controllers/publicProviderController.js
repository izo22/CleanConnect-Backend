// controllers/publicProviderController.js
const Provider = require('../models/Provider');
const Review = require('../models/Review');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Récupérer la liste des prestataires (filtrable)
// @route   GET /api/public/providers
// @access  Public
exports.getProviders = asyncHandler(async (req, res, next) => {
  const { serviceType, serviceArea, minRating } = req.query;
  
  console.log('🔍 ===== RECHERCHE PRESTATAIRES =====');
  console.log('   serviceType demandé:', serviceType);
  console.log('   serviceArea:', serviceArea);
  console.log('   minRating:', minRating);
  
  // Construire le filtre de recherche
  const filter = {};
  
  // Filtrer par type de service si spécifié (chercher dans serviceTypes)
  if (serviceType) {
    filter.serviceTypes = serviceType;
    console.log('   Filtre serviceTypes:', serviceType);
  }
  
  // Filtrer par zone de service si spécifiée
  if (serviceArea) {
    filter.serviceAreas = serviceArea;
    console.log('   Filtre serviceAreas:', serviceArea);
  }
  
  console.log('   Filtre MongoDB final:', JSON.stringify(filter, null, 2));
  
  // Récupérer les prestataires selon les filtres
  let providers = await Provider.find(filter)
    .select('firstName lastName companyName profilePicture serviceTypes serviceDetails serviceAreas');
    
  console.log('   Nombre de prestataires trouvés:', providers.length);
  
  // Récupérer les avis moyens et calculer le prix dynamiquement pour chaque prestataire
  const providersWithRatings = await Promise.all(
    providers.map(async (provider) => {
      // Calculer la note moyenne pour ce prestataire
      const reviews = await Review.find({ provider: provider._id });
      
      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      }
      
      // Convertir en objet standard pour pouvoir ajouter des propriétés
      const providerObject = provider.toObject();
      providerObject.averageRating = averageRating;
      providerObject.reviewCount = reviews.length;
      
      // ✅ NOUVEAU : Calculer dynamiquement le prix à afficher
      if (serviceType && providerObject.serviceDetails && providerObject.serviceDetails.length > 0) {
        // Chercher le prix spécifique pour ce service
        const serviceDetail = providerObject.serviceDetails.find(
          detail => detail.type === serviceType
        );
        
        if (serviceDetail) {
          // Utiliser le prix spécifique du service recherché
          providerObject.hourlyRate = serviceDetail.hourlyRate;
          console.log(`   ✅ ${providerObject.firstName}: Tarif ${serviceType} = ${serviceDetail.hourlyRate}₪`);
        } else {
          // Pas de prix pour ce service (ne devrait pas arriver car on filtre par serviceTypes)
          providerObject.hourlyRate = 0;
          console.log(`   ⚠️ ${providerObject.firstName}: Pas de tarif pour ${serviceType}`);
        }
      } else if (!serviceType && providerObject.serviceDetails && providerObject.serviceDetails.length > 0) {
        // Si aucun service spécifié, calculer le prix moyen à la volée
        const avgPrice = providerObject.serviceDetails.reduce(
          (sum, s) => sum + s.hourlyRate, 
          0
        ) / providerObject.serviceDetails.length;
        providerObject.hourlyRate = Math.round(avgPrice * 100) / 100; // Arrondir à 2 décimales
        console.log(`   ℹ️ ${providerObject.firstName}: Prix moyen calculé = ${providerObject.hourlyRate}₪`);
      } else {
        providerObject.hourlyRate = 0;
        console.log(`   ⚠️ ${providerObject.firstName}: Aucun tarif disponible`);
      }
      
      return providerObject;
    })
  );
  
  // Filtrer par note minimale si spécifiée
  let finalProviders;
  if (minRating) {
    const minRatingVal = parseFloat(minRating);
    finalProviders = providersWithRatings.filter(provider => provider.averageRating >= minRatingVal);
  } else {
    finalProviders = providersWithRatings;
  }
  
  // Trier par note moyenne (décroissante)
  finalProviders.sort((a, b) => b.averageRating - a.averageRating);
  
  console.log('   ✅ Prestataires finaux à envoyer:', finalProviders.length);
  if (finalProviders.length > 0) {
    console.log('   Exemple de prestataire:', {
      firstName: finalProviders[0].firstName,
      serviceType: serviceType,
      hourlyRate: finalProviders[0].hourlyRate,
      serviceDetails: finalProviders[0].serviceDetails
    });
  }
  console.log('==========================================\n');
  
  res.status(200).json({
    success: true,
    count: finalProviders.length,
    data: finalProviders
  });
});

// @desc    Récupérer les détails d'un prestataire spécifique
// @route   GET /api/public/providers/:id
// @access  Public
exports.getProviderDetails = asyncHandler(async (req, res, next) => {
  const providerId = req.params.id;
  
  // Récupérer les informations du prestataire
  const provider = await Provider.findById(providerId)
    .select('-__v -password -resetPasswordToken -resetPasswordExpires');
  
  if (!provider) {
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }
  
  // Récupérer les avis associés à ce prestataire
  const reviews = await Review.find({ provider: providerId })
    .populate('client', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 });
  
  // Formater les avis
  const formattedReviews = reviews.map(review => ({
    id: review._id,
    rating: review.rating,
    comment: review.comment,
    date: review.createdAt,
    client: review.client ? {
      id: review.client._id,
      name: `${review.client.firstName} ${review.client.lastName}`,
      profilePicture: review.client.profilePicture
    } : { name: 'Client anonyme' }
  }));
  
  // Calculer la note moyenne
  let averageRating = 0;
  if (reviews.length > 0) {
    averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }
  
  // Construire l'objet de réponse
  const providerDetails = {
    ...provider.toObject(),
    reviews: formattedReviews,
    averageRating,
    reviewCount: reviews.length
  };
  
  res.status(200).json({
    success: true,
    data: providerDetails
  });
});

// @desc    Soumettre un avis sur un prestataire
// @route   POST /api/public/providers/:id/reviews
// @access  Private (Client authentifié)
exports.submitReview = asyncHandler(async (req, res, next) => {
  const providerId = req.params.id;
  const clientId = req.user.id;
  const { rating, comment } = req.body;
  
  // Vérifier que le prestataire existe
  const provider = await Provider.findById(providerId);
  if (!provider) {
    return next(new ErrorResponse('Prestataire non trouvé', 404));
  }
  
  // Vérifier que la note est valide
  if (!rating || rating < 1 || rating > 5) {
    return next(new ErrorResponse('Veuillez fournir une note valide entre 1 et 5', 400));
  }
  
  // Vérifier si l'utilisateur a déjà laissé un avis pour ce prestataire
  const existingReview = await Review.findOne({ provider: providerId, client: clientId });
  
  if (existingReview) {
    // Mettre à jour l'avis existant
    existingReview.rating = rating;
    existingReview.comment = comment || '';
    await existingReview.save();
    
    res.status(200).json({
      success: true,
      message: 'Avis mis à jour avec succès',
      data: existingReview
    });
  } else {
    // Créer un nouvel avis
    const review = await Review.create({
      provider: providerId,
      client: clientId,
      rating,
      comment: comment || ''
    });
    
    res.status(201).json({
      success: true,
      message: 'Avis ajouté avec succès',
      data: review
    });
  }
});
// @desc    Récupérer les réservations actives d'un prestataire (pour bloquer les créneaux)
// @route   GET /api/public/providers/:id/bookings
// @access  Public
exports.getProviderBookings = asyncHandler(async (req, res, next) => {
  const Request = require('../models/Request');
  const { from, to } = req.query;

  const filter = {
    provider: req.params.id,
    status: { $in: ['pending', 'pending_payment', 'accepted', 'confirmed'] },
  };

  if (from && to) {
    filter.scheduledDate = { $gte: new Date(from), $lte: new Date(to) };
  }
  const bookings = await Request.find(filter).select('scheduledDate duration status');

  res.status(200).json({
    success: true,
    data: bookings,
  });
});