// migrate.js - Script de migration pour normaliser les types de service EN HÉBREU
const mongoose = require('mongoose');

// ✅ NOUVEAU: Mapping français/anglais/hébreu -> hébreu
const serviceTypeMapping = {
  // Français -> hébreu
  'maison': 'בית',
  'bureau': 'משרד',
  'immeuble': 'בניין',
  'airbnb': 'אירבנב',
  // Anglais -> hébreu
  'home': 'בית',
  'office': 'משרד',
  'building': 'בניין',
  // Hébreu -> hébreu (inchangé)
  'בית': 'בית',
  'משרד': 'משרד',
  'בניין': 'בניין',
  'אירבנב': 'אירבנב',
};

async function migrate() {
  try {
    // Connexion à MongoDB
    await mongoose.connect('mongodb://localhost:27017/cleanconnect');
    console.log('✅ Connecté à MongoDB');

    const db = mongoose.connection.db;

    // 1. Migration providers.serviceTypes
    console.log('\n📝 Migration providers.serviceTypes vers hébreu...');
    const providers = await db.collection('providers').find({ serviceTypes: { $exists: true } }).toArray();
    let providerCount = 0;

    for (const provider of providers) {
      if (Array.isArray(provider.serviceTypes)) {
        const originalTypes = [...provider.serviceTypes];
        const updatedServiceTypes = provider.serviceTypes.map(type => 
          serviceTypeMapping[type] || serviceTypeMapping[type?.toLowerCase()] || type
        );
        
        // Vérifier si changement nécessaire
        if (JSON.stringify(originalTypes) !== JSON.stringify(updatedServiceTypes)) {
          await db.collection('providers').updateOne(
            { _id: provider._id },
            { $set: { serviceTypes: updatedServiceTypes } }
          );
          console.log(`  ✅ ${provider.firstName} ${provider.lastName}: ${JSON.stringify(originalTypes)} → ${JSON.stringify(updatedServiceTypes)}`);
          providerCount++;
        }
      }
    }
    console.log(`✅ ${providerCount} providers mis à jour`);

    // 2. Migration providers.serviceDetails
    console.log('\n📝 Migration providers.serviceDetails vers hébreu...');
    const providersWithDetails = await db.collection('providers').find({ "serviceDetails.type": { $exists: true } }).toArray();
    let detailsCount = 0;

    for (const provider of providersWithDetails) {
      if (Array.isArray(provider.serviceDetails)) {
        const updatedServiceDetails = provider.serviceDetails.map(service => ({
          ...service,
          type: serviceTypeMapping[service.type] || serviceTypeMapping[service.type?.toLowerCase()] || service.type
        }));
        
        await db.collection('providers').updateOne(
          { _id: provider._id },
          { $set: { serviceDetails: updatedServiceDetails } }
        );
        detailsCount++;
      }
    }
    console.log(`✅ ${detailsCount} providers.serviceDetails mis à jour`);

    // 3. Migration bookings.serviceType
    console.log('\n📝 Migration bookings.serviceType vers hébreu...');
    let bookingCount = 0;

    for (const [oldType, hebrewType] of Object.entries(serviceTypeMapping)) {
      // Skip si c'est déjà en hébreu
      if (oldType === hebrewType) continue;
      
      const result = await db.collection('bookings').updateMany(
        { serviceType: oldType },
        { $set: { serviceType: hebrewType } }
      );
      bookingCount += result.modifiedCount;
      if (result.modifiedCount > 0) {
        console.log(`  - ${result.modifiedCount} bookings: ${oldType} → ${hebrewType}`);
      }
    }
    console.log(`✅ ${bookingCount} bookings mis à jour au total`);

    // 4. Migration requests.serviceType
    console.log('\n📝 Migration requests.serviceType vers hébreu...');
    let requestCount = 0;

    for (const [oldType, hebrewType] of Object.entries(serviceTypeMapping)) {
      // Skip si c'est déjà en hébreu
      if (oldType === hebrewType) continue;
      
      const result = await db.collection('requests').updateMany(
        { serviceType: oldType },
        { $set: { serviceType: hebrewType } }
      );
      requestCount += result.modifiedCount;
      if (result.modifiedCount > 0) {
        console.log(`  - ${result.modifiedCount} requests: ${oldType} → ${hebrewType}`);
      }
    }
    console.log(`✅ ${requestCount} requests mis à jour au total`);

    // 5. Vérification
    console.log('\n🔍 Vérification post-migration...');
    
    const nonHebrewTypes = ['maison', 'bureau', 'immeuble', 'home', 'office', 'building', 'airbnb'];
    
    const remainingProviders = await db.collection('providers').countDocuments({
      $or: [
        { serviceTypes: { $in: nonHebrewTypes } },
        { "serviceDetails.type": { $in: nonHebrewTypes } }
      ]
    });
    console.log(`Providers non-hébreu restants: ${remainingProviders} (devrait être 0)`);

    const remainingBookings = await db.collection('bookings').countDocuments({
      serviceType: { $in: nonHebrewTypes }
    });
    console.log(`Bookings non-hébreu restants: ${remainingBookings} (devrait être 0)`);

    const remainingRequests = await db.collection('requests').countDocuments({
      serviceType: { $in: nonHebrewTypes }
    });
    console.log(`Requests non-hébreu restants: ${remainingRequests} (devrait être 0)`);

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION TERMINÉE - TOUT EN HÉBREU');
    console.log('='.repeat(60));
    console.log('📊 Résumé:');
    console.log(`   - ${providerCount} providers.serviceTypes`);
    console.log(`   - ${detailsCount} providers.serviceDetails`);
    console.log(`   - ${bookingCount} bookings`);
    console.log(`   - ${requestCount} requests`);

    if (remainingProviders === 0 && remainingBookings === 0 && remainingRequests === 0) {
      console.log('\n✅ Toutes les données normalisées en hébreu avec succès!');
    } else {
      console.log(`\n⚠️  WARNING: ${remainingProviders + remainingBookings + remainingRequests} documents non-hébreu restants`);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Déconnexion MongoDB');
  }
}

migrate();