// backend/src/services/cleanupService.js
// ✅ Service de nettoyage automatique des prestations terminées après 90 jours

const cron = require('node-cron');
const Request = require('../../models/Request');

/**
 * Supprime les prestations terminées depuis plus de 90 jours
 * @returns {Promise<Object>} Résultat de la suppression
 */
const deleteOldCompletedBookings = async () => {
  try {
    const daysToKeep = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    console.log(`🗑️  Nettoyage des prestations terminées avant le ${cutoffDate.toISOString()}`);
    
    // Supprimer les prestations complétées il y a plus de 90 jours
    const result = await Request.deleteMany({
      status: 'completed',
      completedAt: { $ne: null, $lt: cutoffDate }
    });
    
    if (result.deletedCount > 0) {
      console.log(`✅ ${result.deletedCount} prestation(s) supprimée(s) avec succès`);
    } else {
      console.log(`ℹ️  Aucune prestation à supprimer`);
    }
    
    return {
      success: true,
      deletedCount: result.deletedCount,
      cutoffDate: cutoffDate
    };
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage automatique:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Démarre le cron job de nettoyage automatique
 * Exécuté tous les jours à 3h du matin
 */
const startCleanupScheduler = () => {
  // Cron job: tous les jours à 3h du matin (heure du serveur)
  // Format: seconde minute heure jour mois jour_semaine
  cron.schedule('0 3 * * *', async () => {
    console.log('⏰ Démarrage du nettoyage automatique programmé');
    await deleteOldCompletedBookings();
  }, {
    timezone: "Asia/Jerusalem" // Timezone Israël
  });
  
  console.log('✅ Scheduler de nettoyage automatique démarré (tous les jours à 3h)');
};

/**
 * Récupère les statistiques des prestations à nettoyer
 * @returns {Promise<Object>} Statistiques
 */
const getCleanupStats = async () => {
  try {
    const daysToKeep = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const count = await Request.countDocuments({
      status: 'completed',
      completedAt: { $ne: null, $lt: cutoffDate }
    });
    
    return {
      success: true,
      readyForCleanup: count,
      cutoffDate: cutoffDate,
      daysToKeep: daysToKeep
    };
  } catch (error) {
    console.error('Erreur getCleanupStats:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  deleteOldCompletedBookings,
  startCleanupScheduler,
  getCleanupStats
};