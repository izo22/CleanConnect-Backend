// middleware/adminAuth.js
// Protection simple pour le dashboard admin : une clé secrète envoyée
// dans le header x-admin-key, comparée à la variable d'env ADMIN_KEY.
// Pas de rôle "admin" dans le modèle User — volontairement simple,
// pensé pour un usage solo (toi).

const ErrorResponse = require('../utils/errorResponse');

exports.protectAdmin = (req, res, next) => {
  const key = req.headers['x-admin-key'];

  if (!process.env.ADMIN_KEY) {
    return next(new ErrorResponse('ADMIN_KEY non configurée sur le serveur', 500));
  }
  if (!key || key !== process.env.ADMIN_KEY) {
    return next(new ErrorResponse('Accès admin refusé', 401));
  }
  next();
};
