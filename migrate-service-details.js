// migrate-service-details.js
// Script de migration pour ajouter serviceDetails aux prestataires existants
// ✅ VERSION PROPRE : On vire hourlyRate, serviceDetails devient la source de vérité
// ✅ STANDARDISATION : Tout en HÉBREU pour app israélienne

require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');

// ✅ MAPPING pour standardiser : si anglais → convertir en hébreu
// Si déjà hébreu → garder tel quel
const SERVICE_TYPE_MAPPING = {
  // Conversion anglais → hébreu (au cas où)
  'home': 'בית',
  'office': 'משרד',
  'building': 'בניין',
  'airbnb': 'אירבנב',
  // Hébreu → hébreu (passthrough)
  'בית': 'בית',
  'משרד': 'משרד',
  'בניין': 'בניין',
  'אירבנב': 'אירבנב'
};

const migrateServiceDetails = async () => {
  try {
    // Connexion à MongoDB
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cleanconnect', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connecté à MongoDB\n');

    // Récupérer tous les prestataires
    const providers = await Provider.find({});
    console.log(`📊 Nombre de prestataires trouvés: ${providers.length}\n`);

    if (providers.length === 0) {
      console.log('⚠️  Aucun prestataire à migrer');
      process.exit(0);
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const provider of providers) {
      console.log(`\n👤 Prestataire: ${provider.firstName} ${provider.lastName} (${provider.email})`);
      console.log(`   serviceTypes: ${JSON.stringify(provider.serviceTypes)}`);
      console.log(`   serviceDetails (avant): ${JSON.stringify(provider.serviceDetails)}`);

      // Vérifier si serviceDetails existe déjà
      if (provider.serviceDetails && provider.serviceDetails.length > 0) {
        console.log('   ⏭️  serviceDetails existe déjà, on saute ce prestataire');
        skippedCount++;
        continue;
      }

      // ✅ Créer serviceDetails basé sur serviceTypes avec conversion hébreu → anglais
      // Si hourlyRate existe, on l'utilise, sinon on met un prix par défaut
      const defaultPrice = provider.hourlyRate || 50; // Prix par défaut si hourlyRate n'existe pas
      
      const serviceDetails = provider.serviceTypes.map(type => {
        // ✅ Standardiser en hébreu (si anglais → convertir, si hébreu → garder)
        const normalizedType = SERVICE_TYPE_MAPPING[type] || type;
        
        if (type !== normalizedType) {
          console.log(`   🔄 Conversion: ${type} → ${normalizedType}`);
        } else {
          console.log(`   ✅ Garder: ${type}`);
        }
        
        return {
          type: normalizedType,        // ✅ Type normalisé en anglais
          hourlyRate: defaultPrice,
          description: ''              // ✅ Description vide par défaut
        };
      });

      console.log(`   serviceDetails (après): ${JSON.stringify(serviceDetails)}`);
      console.log(`   ⚠️  Prix unique ${defaultPrice}₪ appliqué à tous les services`);
      console.log(`   💡 Le prestataire devra mettre à jour ses prix depuis l'app`);

      // ✅ IMPORTANT : Sauvegarder UNIQUEMENT serviceDetails sans toucher au reste
      // On utilise findByIdAndUpdate pour éviter la validation de serviceTypes
      await Provider.findByIdAndUpdate(
        provider._id,
        { $set: { serviceDetails: serviceDetails } },
        { runValidators: false }  // ✅ Désactiver la validation pour éviter l'erreur enum
      );

      console.log('   ✅ Migré avec succès !');
      migratedCount++;
    }

    console.log('\n\n📋 ===== RÉSUMÉ DE LA MIGRATION =====');
    console.log(`   Total de prestataires: ${providers.length}`);
    console.log(`   Migrés: ${migratedCount}`);
    console.log(`   Ignorés (déjà migrés): ${skippedCount}`);
    console.log('=====================================\n');

    // Vérification finale
    console.log('🔍 Vérification des données après migration...\n');
    const verifiedProviders = await Provider.find({});
    
    for (const provider of verifiedProviders) {
      console.log(`✅ ${provider.firstName}: serviceDetails = ${JSON.stringify(provider.serviceDetails)}`);
    }

    console.log('\n⚠️  IMPORTANT: Les prestataires existants ont tous le même prix pour tous leurs services.');
    console.log('   Ils devront mettre à jour leurs prix depuis l\'application.');
    console.log('\n✅ Migration terminée avec succès !');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Exécuter la migration
migrateServiceDetails();