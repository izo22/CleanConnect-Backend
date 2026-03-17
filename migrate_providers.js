// migrate_providers.js
// Script de migration : serviceTypes + hourlyRate → serviceDetails

const mongoose = require('mongoose');

// Configuration MongoDB
const MONGODB_URI = 'mongodb://localhost:27017/cleanconnect';
// OU si tu utilises MongoDB Atlas :
// const MONGODB_URI = 'mongodb+srv://username:password@cluster.mongodb.net/cleanconnect';

// Schéma Provider
const providerSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  hourlyRate: Number,
  serviceTypes: [String],
  serviceDetails: [{
    type: String,
    hourlyRate: Number,
    description: String
  }]
}, { strict: false });

const Provider = mongoose.model('Provider', providerSchema);

async function migrateProviders() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Récupérer tous les providers
    const providers = await Provider.find({ role: 'provider' });
    console.log(`📊 ${providers.length} providers trouvés\n`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const provider of providers) {
      console.log(`\n👤 Provider: ${provider.firstName} ${provider.lastName} (${provider.email})`);
      console.log(`   hourlyRate actuel: ${provider.hourlyRate}₪`);
      console.log(`   serviceTypes: ${provider.serviceTypes ? provider.serviceTypes.length : 0}`);
      console.log(`   serviceDetails: ${provider.serviceDetails ? provider.serviceDetails.length : 0}`);

      // Vérifier si serviceDetails est vide ou inexistant
      if (!provider.serviceDetails || provider.serviceDetails.length === 0) {
        console.log('   🔄 Migration nécessaire...');

        // Créer serviceDetails à partir de serviceTypes et hourlyRate
        const newServiceDetails = [];

        if (provider.serviceTypes && provider.serviceTypes.length > 0) {
          // Utiliser les serviceTypes existants
          provider.serviceTypes.forEach(type => {
            newServiceDetails.push({
              type: type,
              hourlyRate: provider.hourlyRate || 0,
              description: ''
            });
          });
        } else {
          // Si pas de serviceTypes, créer avec les 4 types par défaut
          console.log('   ⚠️  Aucun serviceTypes trouvé, création avec valeurs par défaut');
          ['בית', 'בניין', 'משרד', 'אירבנב'].forEach(type => {
            newServiceDetails.push({
              type: type,
              hourlyRate: provider.hourlyRate || 0,
              description: ''
            });
          });
        }

        // Sauvegarder
        provider.serviceDetails = newServiceDetails;
        
        // S'assurer que serviceTypes est bien défini
        if (!provider.serviceTypes || provider.serviceTypes.length === 0) {
          provider.serviceTypes = newServiceDetails.map(s => s.type);
        }

        await provider.save();

        console.log('   ✅ Migration réussie !');
        console.log('   Nouveau serviceDetails:');
        newServiceDetails.forEach((s, i) => {
          console.log(`      ${i + 1}. ${s.type}: ${s.hourlyRate}₪`);
        });

        migratedCount++;
      } else {
        console.log('   ⏭️  Déjà migré, skip');
        skippedCount++;
      }
    }

    console.log('\n\n🎉 ===== MIGRATION TERMINÉE =====');
    console.log(`✅ ${migratedCount} providers migrés`);
    console.log(`⏭️  ${skippedCount} providers déjà migrés`);
    console.log(`📊 Total: ${providers.length} providers`);

    // Vérification finale
    console.log('\n🔍 ===== VÉRIFICATION FINALE =====');
    const fufu = await Provider.findOne({ email: 'fufu@gmail.com' });
    
    if (fufu) {
      console.log(`👤 Provider fufu@gmail.com:`);
      console.log(`   hourlyRate: ${fufu.hourlyRate}₪`);
      console.log(`   serviceDetails: ${fufu.serviceDetails.length} services`);
      fufu.serviceDetails.forEach((s, i) => {
        console.log(`      ${i + 1}. ${s.type}: ${s.hourlyRate}₪`);
      });
    }

    console.log('\n✅ Migration complète ! Tous les providers ont maintenant serviceDetails.');
    console.log('📱 Tu peux maintenant modifier les tarifs dans l\'app et ils seront sauvegardés.');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

// Exécuter la migration
console.log('🚀 ===== MIGRATION DES PROVIDERS =====\n');
console.log('Ce script va créer serviceDetails[] pour tous les providers');
console.log('à partir de leurs serviceTypes[] et hourlyRate existants.\n');

migrateProviders();

// INSTRUCTIONS :
// 1. Vérifie l'URL MongoDB ligne 6
// 2. node migrate_providers.js
// 3. Tous les providers auront serviceDetails[]
// 4. Tu pourras ensuite modifier les tarifs dans l'app