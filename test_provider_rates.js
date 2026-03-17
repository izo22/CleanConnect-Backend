// test_provider_rates.js
// Script de test MongoDB pour vérifier la synchronisation des tarifs

const mongoose = require('mongoose');

// Configuration MongoDB
const MONGODB_URI = 'mongodb://localhost:27017/cleanconnect';
// OU si tu utilises MongoDB Atlas :
// const MONGODB_URI = 'mongodb+srv://username:password@cluster.mongodb.net/cleanconnect';

// Schéma Provider simplifié pour le test
const providerSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
  hourlyRate: Number,
  serviceDetails: [{
    type: String,
    hourlyRate: Number
  }],
  serviceTypes: [String]
});

const Provider = mongoose.model('Provider', providerSchema);

async function testProviderRates() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Test 1 : Vérifier l'état actuel
    console.log('📊 ===== TEST 1 : ÉTAT ACTUEL =====');
    const provider = await Provider.findOne({ email: 'fufu@gmail.com' });
    
    if (!provider) {
      console.log('❌ Provider fufu@gmail.com non trouvé !');
      return;
    }

    console.log(`👤 Provider: ${provider.firstName} ${provider.lastName}`);
    console.log(`📧 Email: ${provider.email}`);
    console.log(`💰 hourlyRate (moyen): ${provider.hourlyRate}₪`);
    console.log(`📋 serviceTypes:`, provider.serviceTypes);
    console.log(`🏷️  serviceDetails:`);
    
    if (provider.serviceDetails && provider.serviceDetails.length > 0) {
      provider.serviceDetails.forEach((service, index) => {
        console.log(`   ${index + 1}. ${service.type}: ${service.hourlyRate}₪`);
      });
      
      // Vérifier la cohérence
      const calculatedAverage = provider.serviceDetails.reduce((sum, s) => sum + s.hourlyRate, 0) / provider.serviceDetails.length;
      console.log(`\n🧮 Calcul du tarif moyen:`);
      console.log(`   Somme: ${provider.serviceDetails.reduce((sum, s) => sum + s.hourlyRate, 0)}₪`);
      console.log(`   Nombre de services: ${provider.serviceDetails.length}`);
      console.log(`   Moyenne calculée: ${calculatedAverage.toFixed(2)}₪`);
      console.log(`   Moyenne stockée: ${provider.hourlyRate}₪`);
      
      if (Math.abs(calculatedAverage - provider.hourlyRate) > 0.01) {
        console.log(`   ⚠️  INCOHÉRENCE DÉTECTÉE !`);
        console.log(`   Différence: ${Math.abs(calculatedAverage - provider.hourlyRate).toFixed(2)}₪`);
      } else {
        console.log(`   ✅ Cohérence OK`);
      }
    } else {
      console.log('   ⚠️  Aucun serviceDetails trouvé !');
    }

    // Test 2 : Simuler une mise à jour
    console.log('\n📝 ===== TEST 2 : SIMULATION MISE À JOUR =====');
    const newServiceDetails = [
      { type: 'בית', hourlyRate: 80 },
      { type: 'בניין', hourlyRate: 85 },
      { type: 'משרד', hourlyRate: 90 },
      { type: 'אירבנב', hourlyRate: 95 }
    ];
    
    console.log('Nouveaux tarifs à appliquer:');
    newServiceDetails.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.type}: ${s.hourlyRate}₪`);
    });
    
    const newAverage = newServiceDetails.reduce((sum, s) => sum + s.hourlyRate, 0) / newServiceDetails.length;
    console.log(`\nTarif moyen calculé: ${newAverage.toFixed(2)}₪`);
    
    console.log('\n❓ Voulez-vous appliquer cette mise à jour ? (Commenter/Décommenter la ligne ci-dessous)');
    
    // ⚠️ DÉCOMMENTER POUR APPLIQUER LA MISE À JOUR
    // await Provider.findOneAndUpdate(
    //   { email: 'fufu@gmail.com' },
    //   { 
    //     serviceDetails: newServiceDetails,
    //     hourlyRate: newAverage,
    //     serviceTypes: newServiceDetails.map(s => s.type)
    //   }
    // );
    // console.log('✅ Mise à jour appliquée !');

    // Test 3 : Vérifier tous les providers
    console.log('\n👥 ===== TEST 3 : TOUS LES PROVIDERS =====');
    const allProviders = await Provider.find({ role: 'provider' })
      .select('firstName lastName email hourlyRate serviceDetails')
      .limit(10);
    
    console.log(`Total de providers: ${allProviders.length}`);
    
    allProviders.forEach((p, index) => {
      console.log(`\n${index + 1}. ${p.firstName} ${p.lastName} (${p.email})`);
      console.log(`   hourlyRate: ${p.hourlyRate}₪`);
      console.log(`   serviceDetails: ${p.serviceDetails ? p.serviceDetails.length : 0} services`);
      
      if (p.serviceDetails && p.serviceDetails.length > 0) {
        const avg = p.serviceDetails.reduce((sum, s) => sum + s.hourlyRate, 0) / p.serviceDetails.length;
        if (Math.abs(avg - p.hourlyRate) > 0.01) {
          console.log(`   ⚠️  INCOHÉRENCE: calculé=${avg.toFixed(2)}₪ stocké=${p.hourlyRate}₪`);
        }
      }
    });

    console.log('\n✅ Tests terminés !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

// Exécuter les tests
testProviderRates();

// INSTRUCTIONS D'UTILISATION :
// 1. Installer mongoose si nécessaire : npm install mongoose
// 2. Modifier MONGODB_URI avec ton URL MongoDB
// 3. Exécuter : node test_provider_rates.js
// 4. Pour appliquer une mise à jour, décommenter les lignes du TEST 2