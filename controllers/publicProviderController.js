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
  
  // Mapper les types de service du frontend vers le modèle
  const serviceTypeMapping = {
    'home': 'maison',
    'office': 'bureau', 
    'building': 'immeuble',
    'other': 'autre'
  };
  
  // Construire le filtre de recherche
  const filter = {};
  
  // Filtrer par type de service si spécifié
  if (serviceType) {
    const mappedServiceType = serviceTypeMapping[serviceType] || serviceType;
    // Chercher dans serviceTypes OU dans serviceDetails
    filter.$or = [
      { serviceTypes: mappedServiceType },
      { 'serviceDetails.type': mappedServiceType }
    ];
  }
  
  // Filtrer par zone de service si spécifiée
  if (serviceArea) {
    filter.serviceAreas = serviceArea;
  }
  
  // Debug: Afficher le filtre utilisé
  console.log('Filtre appliqué:', JSON.stringify(filter, null, 2));
  
  // Récupérer tous les prestataires pour debug
  const allProviders = await Provider.find({})
    .select('firstName lastName serviceTypes serviceDetails services serviceAreas hourlyRate');
  
  console.log('Nombre total de prestataires en base:', allProviders.length);
  console.log('Exemple de structure d\'un prestataire:');
  if (allProviders.length > 0) {
    console.log({
      firstName: allProviders[0].firstName,
      serviceTypes: allProviders[0].serviceTypes,
      serviceDetails: allProviders[0].serviceDetails,
      services: allProviders[0].services
    });
  }
  
  // Récupérer les prestataires selon les filtres
  let providers = await Provider.find(filter)
    .select('firstName lastName companyName profilePicture services serviceTypes serviceDetails serviceAreas hourlyRate');
    
  console.log('Prestataires trouvés avec le filtre:', providers.length);
  
  // Récupérer les avis moyens pour chaque prestataire
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
  
  console.log('Prestataires finaux à envoyer:', finalProviders.length);
  console.log('Données envoyées au frontend:', {
    success: true,
    count: finalProviders.length,
    firstProvider: finalProviders[0] ? {
      firstName: finalProviders[0].firstName,
      hourlyRate: finalProviders[0].hourlyRate
    } : 'Aucun'
  });
  
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