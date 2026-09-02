// controllers/adminController.js
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Request = require('../models/Request'); // fichier models/Request.js

// Construit un ObjectId "daté" pour filtrer par ancienneté sans dépendre
// d'un champ createdAt explicite (l'ObjectId Mongo encode déjà l'heure
// de création dans ses 4 premiers octets).
function objectIdFromDate(date) {
  return mongoose.Types.ObjectId.createFromTime(Math.floor(date.getTime() / 1000));
}

// @route   GET /api/admin/stats
exports.getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const idToday = objectIdFromDate(startOfToday);
  const id7d = objectIdFromDate(sevenDaysAgo);
  const id30d = objectIdFromDate(thirtyDaysAgo);

  const [
    totalClients, totalProviders, totalBookings,
    newClientsToday, newClients7d, newClients30d,
    newProvidersToday, newProviders7d, newProviders30d,
    bookingsPending, bookingsAccepted, bookingsCompleted, bookingsCancelled,
    recentClients, recentProviders, recentBookings,
  ] = await Promise.all([
    User.countDocuments(),
    Provider.countDocuments(),
    Request.countDocuments(),
    User.countDocuments({ _id: { $gte: idToday } }),
    User.countDocuments({ _id: { $gte: id7d } }),
    User.countDocuments({ _id: { $gte: id30d } }),
    Provider.countDocuments({ _id: { $gte: idToday } }),
    Provider.countDocuments({ _id: { $gte: id7d } }),
    Provider.countDocuments({ _id: { $gte: id30d } }),
    Request.countDocuments({ status: 'pending' }),
    Request.countDocuments({ status: 'accepted' }),
    Request.countDocuments({ status: 'completed' }),
    Request.countDocuments({ status: 'cancelled' }),
    User.find().sort({ _id: -1 }).limit(15).select('firstName lastName email city phone'),
    Provider.find().sort({ _id: -1 }).limit(15).select('firstName lastName email serviceTypes serviceAreas'),
    Request.find().sort({ _id: -1 }).limit(20)
      .populate('client', 'firstName lastName')
      .populate('provider', 'firstName lastName'),
  ]);

  res.status(200).json({
    success: true,
    data: {
      clients: { total: totalClients, today: newClientsToday, last7Days: newClients7d, last30Days: newClients30d },
      providers: { total: totalProviders, today: newProvidersToday, last7Days: newProviders7d, last30Days: newProviders30d },
      bookings: {
        total: totalBookings,
        pending: bookingsPending,
        accepted: bookingsAccepted,
        completed: bookingsCompleted,
        cancelled: bookingsCancelled,
      },
      recentClients,
      recentProviders,
      recentBookings,
    },
  });
});
