// controllers/authController.js
// ✅ CORRIGÉ : Validation stricte de serviceAreas + logs détaillés

const User = require('../models/User');
const Provider = require('../models/Provider');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ✅ Fonction pour normaliser les serviceTypes vers l'hébreu
const normalizeServiceTypesToHebrew = (serviceTypes) => {
  if (!serviceTypes || !Array.isArray(serviceTypes)) {
    return [];
  }
  
  const mapping = {
    // Français → Hébreu
    'maison': 'בית',
    'bureau': 'משרד',
    'immeuble': 'בניין',
    'airbnb': 'אירבנב',
    // Anglais → Hébreu
    'home': 'בית',
    'office': 'משרד',
    'building': 'בניין',
    // Hébreu → Hébreu (inchangé)
    'בית': 'בית',
    'משרד': 'משרד',
    'בניין': 'בניין',
    'אירבנב': 'אירבנב',
    'מעבר_דירה': 'מעבר_דירה',
    'ניקיון_גדול': 'ניקיון_גדול',
  };
  
  return serviceTypes.map(type => {
    const normalized = mapping[type?.toLowerCase()] || mapping[type];
    if (!normalized) {
      console.warn(`⚠️  Type de service inconnu: "${type}"`);
      return type; // Garder tel quel si inconnu
    }
    return normalized;
  });
};

// @desc      Inscrire un client
// @route     POST /api/auth/register/client
// @access    Public
exports.registerClient = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, address, city, addresses, language } = req.body;

    console.log('📝 Inscription client avec données:', { firstName, lastName, email, phone, address, city });

    // Vérifier si l'utilisateur existe déjà
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    // Créer un nouvel utilisateur avec address et city
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      address,
      city,
      addresses: addresses || [],
      language: language || 'he'
    });

    console.log('✅ Utilisateur créé dans MongoDB:', {
      id: user._id,
      email: user.email,
      phone: user.phone,
      address: user.address,
      city: user.city
    });

    // Générer un token
    const token = user.getSignedJwtToken();

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        role: user.role,
        language: user.language
      }
    });
  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription du client',
      error: error.message
    });
  }
};

// @desc      Inscrire un prestataire
// @route     POST /api/auth/register/provider
// @access    Public
exports.registerProvider = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      serviceTypes,
      serviceAreas,
      services, // ✅ Recevoir les détails des services
      language
    } = req.body;

    console.log('📝 ===== INSCRIPTION PRESTATAIRE =====');
    console.log('   firstName:', firstName);
    console.log('   lastName:', lastName);
    console.log('   email:', email);
    console.log('   phone:', phone);
    console.log('   serviceTypes (reçu):', JSON.stringify(serviceTypes));
    console.log('   serviceAreas (reçu):', JSON.stringify(serviceAreas));
    console.log('   services (reçu):', JSON.stringify(services));

    // ✅ NORMALISATION - Convertir serviceTypes en hébreu
    const normalizedServiceTypes = normalizeServiceTypesToHebrew(serviceTypes);
    console.log('   serviceTypes (normalisé):', JSON.stringify(normalizedServiceTypes));

    // ✅ VALIDATION STRICTE - serviceAreas
    if (!serviceAreas || !Array.isArray(serviceAreas) || serviceAreas.length === 0) {
      console.error('❌ ERREUR CRITIQUE: serviceAreas vide ou invalide!');
      console.error('   serviceAreas reçu:', serviceAreas);
      return res.status(400).json({
        success: false,
        message: 'Au moins une ville doit être sélectionnée pour les zones de service',
        field: 'serviceAreas',
        receivedValue: serviceAreas
      });
    }

    // ✅ VALIDATION STRICTE - serviceTypes
    if (!normalizedServiceTypes || !Array.isArray(normalizedServiceTypes) || normalizedServiceTypes.length === 0) {
      console.error('❌ ERREUR CRITIQUE: serviceTypes vide ou invalide après normalisation!');
      return res.status(400).json({
        success: false,
        message: 'Au moins un type de service doit être sélectionné',
        field: 'serviceTypes',
        receivedValue: serviceTypes
      });
    }

    // ✅ VALIDATION STRICTE - services avec tarifs
    if (!services || !Array.isArray(services) || services.length === 0) {
      console.error('❌ ERREUR CRITIQUE: services vide ou invalide!');
      return res.status(400).json({
        success: false,
        message: 'Au moins un service avec tarif doit être défini',
        field: 'services',
        receivedValue: services
      });
    }

    // Vérifier si le prestataire existe déjà
    const providerExists = await Provider.findOne({ email });
    if (providerExists) {
      console.log('⚠️  Email déjà utilisé:', email);
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    // ✅ Préparer serviceDetails depuis services
    const serviceDetails = services.map(service => ({
      type: service.type,
      hourlyRate: service.hourlyRate
    }));
    console.log('   serviceDetails (préparé):', JSON.stringify(serviceDetails));

    // ✅ Créer un nouveau prestataire
    console.log('💾 Création du prestataire dans MongoDB...');
    const provider = await Provider.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      serviceTypes: normalizedServiceTypes,
      serviceAreas,
      serviceDetails, // ✅ SOURCE DE VÉRITÉ UNIQUE
      role: 'provider',
      language: language || 'he'
    });

    console.log('✅ ===== PRESTATAIRE CRÉÉ AVEC SUCCÈS =====');
    console.log('   ID:', provider._id);
    console.log('   Email:', provider.email);
    console.log('   serviceTypes (sauvegardé):', JSON.stringify(provider.serviceTypes));
    console.log('   serviceAreas (sauvegardé):', JSON.stringify(provider.serviceAreas));
    console.log('   serviceDetails (sauvegardé):', JSON.stringify(provider.serviceDetails));
    console.log('   Role:', provider.role);
    console.log('==========================================\n');

    // Générer un token
    const token = provider.getSignedJwtToken();

    res.status(201).json({
      success: true,
      token,
      provider: {
        id: provider._id,
        firstName: provider.firstName,
        lastName: provider.lastName,
        email: provider.email,
        phone: provider.phone,
        role: provider.role,
        serviceTypes: provider.serviceTypes,
        serviceAreas: provider.serviceAreas,
        serviceDetails: provider.serviceDetails,
        language: provider.language
      }
    });
  } catch (error) {
    console.error('❌ ===== ERREUR INSCRIPTION PRESTATAIRE =====');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    
    // Afficher les détails de validation Mongoose
    if (error.name === 'ValidationError') {
      console.error('   Erreurs de validation Mongoose:');
      Object.keys(error.errors).forEach(key => {
        console.error(`      - ${key}: ${error.errors[key].message}`);
      });
    }
    console.error('===========================================\n');
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription du prestataire',
      error: error.message,
      validationErrors: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : null
    });
  }
};

// @desc      Connecter un utilisateur (client ou prestataire)
// @route     POST /api/auth/login
// @access    Public
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un email et un mot de passe'
      });
    }
    
    console.log('🔐 Tentative de connexion:', { email, role });
    
    let user = null;
    let userRole = '';
    
    if (role === 'provider') {
      user = await Provider.findOne({ email }).select('+password');
      userRole = 'provider';
    } else if (role === 'client') {
      user = await User.findOne({ email }).select('+password');
      userRole = 'client';
    } else {
      user = await User.findOne({ email }).select('+password');
      
      if (user) {
        userRole = 'client';
      } else {
        user = await Provider.findOne({ email }).select('+password');
        userRole = 'provider';
      }
    }
    
    console.log('👤 Utilisateur trouvé:', user ? {
      id: user._id,
      email: user.email,
      role: userRole,
      phone: user.phone,
      address: user.address,
      city: user.city
    } : 'Aucun utilisateur trouvé');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }
    
    if (!user.password) {
      console.log('❌ Mot de passe manquant dans la base de données');
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔑 Vérification mot de passe:', isPasswordValid);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }
    
    const token = jwt.sign(
      { id: user._id, role: userRole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
    
    console.log('✅ Connexion réussie, envoi des données complètes');
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        role: userRole
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: error.message
    });
  }
};

// @desc      Obtenir l'utilisateur actuellement connecté
// @route     GET /api/auth/me
// @access    Private
exports.getMe = async (req, res) => {
  try {
    let user;
    
    if (req.user.role === 'client') {
      user = await User.findById(req.user.id);
    } else {
      user = await Provider.findById(req.user.id);
    }

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
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données utilisateur',
      error: error.message
    });
  }
};