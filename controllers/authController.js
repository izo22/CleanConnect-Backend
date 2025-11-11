// controllers/authController.js
const User = require('../models/User');
const Provider = require('../models/Provider');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// @desc      Inscrire un client
// @route     POST /api/auth/register/client
// @access    Public
exports.registerClient = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, addresses, language } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    // Créer un nouvel utilisateur
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      addresses: addresses || [],
      language: language || 'he'
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
        role: user.role,
        language: user.language
      }
    });
  } catch (error) {
    console.error(error);
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
      hourlyRate,
      language
    } = req.body;

    // Vérifier si le prestataire existe déjà
    const providerExists = await Provider.findOne({ email });
    if (providerExists) {
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    // Créer un nouveau prestataire
    const provider = await Provider.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      serviceTypes,
      serviceAreas,
      hourlyRate,
      language: language || 'he'
    });

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
        role: provider.role,
        serviceTypes: provider.serviceTypes,
        language: provider.language
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription du prestataire',
      error: error.message
    });
  }
};

// @desc      Connecter un utilisateur (client ou prestataire)
// @route     POST /api/auth/login
// @access    Public
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Vérifier que l'email et le mot de passe sont fournis
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un email et un mot de passe'
      });
    }
    
    console.log('Tentative de connexion:', { email, role });
    
    let user = null;
    let userRole = '';
    
    // Si un rôle spécifique est fourni, chercher uniquement dans la collection correspondante
   // Si un rôle spécifique est fourni, chercher uniquement dans la collection correspondante
if (role === 'provider') {
  user = await Provider.findOne({ email }).select('+password');
  userRole = 'provider';
} else if (role === 'client') {
  user = await User.findOne({ email }).select('+password');
  userRole = 'client';
} else {
  // Si aucun rôle n'est spécifié, chercher dans les deux collections
  user = await User.findOne({ email }).select('+password');
  
  if (user) {
    userRole = 'client';
  } else {
    user = await Provider.findOne({ email }).select('+password');
    userRole = 'provider';
  }
}
    
    console.log('Utilisateur trouvé dans la base:', user ? {
      id: user._id,
      email: user.email,
      role: userRole,
      exists: !!user
    } : 'Aucun utilisateur trouvé');
    
    // Si l'utilisateur n'existe pas
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }
    
    // Vérifier que le mot de passe existe dans la base de données
    if (!user.password) {
      console.log('Mot de passe manquant dans la base de données pour cet utilisateur');
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }
    
    // Vérification du mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Résultat de la vérification du mot de passe:', isPasswordValid);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }
    
    // Générer un token JWT
    const token = jwt.sign(
      { id: user._id, role: userRole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
    
    // Répondre avec le token et les infos utilisateur
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: userRole
      }
    });
    
  } catch (error) {
    console.error('Erreur de connexion:', error);
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