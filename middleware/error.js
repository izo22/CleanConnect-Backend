// middleware/error.js
// ✅ Error handler global — force toujours une réponse JSON
// Avant : Express pouvait renvoyer du HTML en cas d'erreur (ex: Tranzila Bad Request)
//         ce qui causait l'affichage brut du HTML dans l'app React Native

const errorHandler = (err, req, res, next) => {
    console.error(`❌ [ERROR HANDLER] ${err.statusCode || 500} — ${err.message}`);
  
    if (process.env.NODE_ENV === 'development') {
      console.error(err.stack);
    }
  
    // ✅ Toujours répondre en JSON, quelle que soit l'origine de l'erreur
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Erreur serveur interne',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  };
  
  module.exports = errorHandler;