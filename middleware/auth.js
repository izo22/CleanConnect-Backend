// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');

// Middleware pour protéger les routes
exports.protect = async (req, res, next) => {
  let token;

  // Vérifier si le token est présent dans les headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Vérifier si le token existe
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Non autorisé à accéder à cette route'
    });
  }

  try {
    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Trouver l'utilisateur correspondant au token
    if (decoded.role === 'client') {
      req.user = await User.findById(decoded.id);
    } else if (decoded.role === 'provider') {
      req.user = await Provider.findById(decoded.id);
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Ajouter le rôle à l'objet utilisateur si ce n'est pas déjà fait
    req.user.role = decoded.role;

    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({
      success: false,
      message: 'Non autorisé à accéder à cette route'
    });
  }
};

// Middleware pour restreindre l'accès selon le rôle
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Le rôle ${req.user.role} n'est pas autorisé à accéder à cette route`
      });
    }
    next();
  };
};