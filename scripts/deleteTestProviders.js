// scripts/deleteTestProviders.js
// Usage :
//   node scripts/deleteTestProviders.js                  → LISTE seulement (rien n'est supprimé)
//   node scripts/deleteTestProviders.js --delete ID1 ID2 → supprime ces providers + leurs requests/reviews
//   node scripts/deleteTestProviders.js --delete-all     → supprime TOUS les providers + leurs requests/reviews

require('dotenv').config();
const mongoose = require('mongoose');

const Provider = require('../models/Provider');
const Request  = require('../models/Request');
const Review   = require('../models/Review');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

(async () => {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI introuvable dans .env');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté à MongoDB\n');

  const args = process.argv.slice(2);
  const deleteAll = args.includes('--delete-all');
  const deleteMode = args.includes('--delete');
  const ids = args.filter(a => !a.startsWith('--'));

  // ── Mode LISTE ──────────────────────────────────────────────────────────────
  if (!deleteMode && !deleteAll) {
    const providers = await Provider.find({}).select('email firstName lastName phone createdAt');
    console.log(`📋 ${providers.length} provider(s) en base :\n`);
    for (const p of providers) {
      const nbRequests = await Request.countDocuments({ provider: p._id });
      const nbReviews  = await Review.countDocuments({ provider: p._id });
      console.log(`  ${p._id}`);
      console.log(`    ${p.firstName} ${p.lastName} — ${p.email} — ${p.phone}`);
      console.log(`    requests: ${nbRequests} | reviews: ${nbReviews}\n`);
    }
    console.log('ℹ️  Rien n\'a été supprimé. Pour supprimer :');
    console.log('    node scripts/deleteTestProviders.js --delete <id1> <id2> ...');
    console.log('    node scripts/deleteTestProviders.js --delete-all');
    await mongoose.disconnect();
    return;
  }

  // ── Mode SUPPRESSION ────────────────────────────────────────────────────────
  let targets;
  if (deleteAll) {
    targets = await Provider.find({}).select('_id email firstName lastName');
  } else {
    if (ids.length === 0) {
      console.error('❌ --delete nécessite au moins un ID');
      await mongoose.disconnect();
      process.exit(1);
    }
    targets = await Provider.find({ _id: { $in: ids } }).select('_id email firstName lastName');
  }

  if (targets.length === 0) {
    console.log('⚠️ Aucun provider trouvé pour ces critères');
    await mongoose.disconnect();
    return;
  }

  console.log(`🗑️  Suppression de ${targets.length} provider(s) :\n`);

  for (const p of targets) {
    const targetId = p._id;
    const delRequests = await Request.deleteMany({ provider: targetId });
    const delReviews  = await Review.deleteMany({ provider: targetId });
    await Provider.deleteOne({ _id: targetId });
    console.log(`  ✅ ${p.firstName} ${p.lastName} (${p.email})`);
    console.log(`     → ${delRequests.deletedCount} request(s), ${delReviews.deletedCount} review(s) supprimées`);
  }

  console.log('\n✅ Terminé');
  await mongoose.disconnect();
})().catch(e => {
  console.error('❌ Erreur:', e.message);
  process.exit(1);
});