// controllers/notificationController.js
// ✅ Contrôleur pour gérer les tokens de notifications push

const User = require('../models/User');
const Provider = require('../models/Provider');

/**
 * @desc    Enregistrer/mettre à jour le push token d'un utilisateur
 * @route   POST /api/notifications/token
 * @access  Private (client ou provider)
 */
exports.savePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'Push token manquant'
      });
    }

    console.log('📱 Enregistrement push token:', {
      userId: req.user.id,
      role: req.user.role,
      token: pushToken.substring(0, 30) + '...'
    });

    // Mettre à jour selon le rôle
    let updatedUser;
    if (req.user.role === 'client') {
      updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { pushToken },
        { new: true }
      );
    } else if (req.user.role === 'provider') {
      updatedUser = await Provider.findByIdAndUpdate(
        req.user.id,
        { pushToken },
        { new: true }
      );
    }

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    console.log('✅ Push token enregistré avec succès');

    res.status(200).json({
      success: true,
      message: 'Push token enregistré'
    });

  } catch (error) {
    console.error('❌ Erreur savePushToken:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du push token'
    });
  }
};

/**
 * @desc    Supprimer le push token (lors de la déconnexion)
 * @route   DELETE /api/notifications/token
 * @access  Private (client ou provider)
 */
exports.removePushToken = async (req, res) => {
  try {
    console.log('🗑️ Suppression push token:', {
      userId: req.user.id,
      role: req.user.role
    });

    // Mettre à jour selon le rôle
    let updatedUser;
    if (req.user.role === 'client') {
      updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { pushToken: null },
        { new: true }
      );
    } else if (req.user.role === 'provider') {
      updatedUser = await Provider.findByIdAndUpdate(
        req.user.id,
        { pushToken: null },
        { new: true }
      );
    }

    console.log('✅ Push token supprimé');

    res.status(200).json({
      success: true,
      message: 'Push token supprimé'
    });

  } catch (error) {
    console.error('❌ Erreur removePushToken:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du push token'
    });
  }
};