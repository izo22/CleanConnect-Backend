// backend/migrateCompletedDates.js
// ✅ Script de migration unique pour ajouter completedAt aux prestations déjà terminées

const mongoose = require('mongoose');
const Request = require('./models/Request');
require('dotenv').config();

/**
 * Met à jour toutes les prestations completed sans date completedAt
 * En utilisant leur date updatedAt comme référence
 */
async function migrateCompletedDates() {
  try {
    console.log('🔄 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connecté à MongoDB');
    
    // Trouver toutes les prestations completed sans completedAt
    const prestationsToMigrate = await Request.find({
      status: 'completed',
      completedAt: null
    });
    
    console.log(`📊 ${prestationsToMigrate.length} prestation(s) à migrer`);
    
    if (prestationsToMigrate.length === 0) {
      console.log('✅ Aucune migration nécessaire, toutes les prestations ont déjà un completedAt');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // Mettre à jour chaque prestation
    let migratedCount = 0;
    for (const prestation of prestationsToMigrate) {
      // Utiliser updatedAt comme date de complétion
      prestation.completedAt = prestation.updatedAt || prestation.createdAt;
      await prestation.save();
      migratedCount++;
      
      if (migratedCount % 10 === 0) {
        console.log(`⏳ ${migratedCount}/${prestationsToMigrate.length} migrées...`);
      }
    }
    
    console.log(`✅ Migration terminée : ${migratedCount} prestation(s) migrée(s)`);
    
    // Vérification
    const remaining = await Request.countDocuments({
      status: 'completed',
      completedAt: null
    });
    
    if (remaining > 0) {
      console.warn(`⚠️  Attention : ${remaining} prestation(s) n'ont pas été migrées`);
    } else {
      console.log('✅ Vérification OK : toutes les prestations completed ont maintenant un completedAt');
    }
    
    await mongoose.connection.close();
    console.log('👋 Déconnexion MongoDB');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

// Exécuter la migration
console.log('🚀 Démarrage de la migration des dates de complétion');
console.log('📝 Ce script va ajouter completedAt aux prestations completed existantes\n');

migrateCompletedDates();