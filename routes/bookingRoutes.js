// routes/bookingRoutes.js
// ✅ Routes réservations avec système de paiement escrow + AUTO-DELETE

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { createBooking, getUserBookings } = require('../controllers/userController');
const paymentController = require('../controllers/paymentController');
const Request = require('../models/Request');

// ══════════════════════════════════════════════════════
// RÉSERVATIONS
// ══════════════════════════════════════════════════════

// ✅ Créer une réservation avec paiement
router.post('/', protect, authorize('client'), createBooking);

// ✅ Récupérer les réservations du client
router.get('/', protect, authorize('client'), getUserBookings);

// ✅ Récupérer une réservation spécifique
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await Request.findById(req.params.id)
      .populate('provider', 'firstName lastName phone email rating');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
    }

    if (
      booking.client.toString() !== req.user.id &&
      booking.provider._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Erreur getBooking:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la réservation' });
  }
});

// ✅ Annuler une réservation (avec remboursement automatique carte ou Bit)
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Request.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
    }

    if (booking.client.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cette réservation ne peut pas être annulée' });
    }

    // ✅ Rembourser via Tranzila si paiement en attente
    if (booking.payment.status === 'held') {
      const PaymentService = require('../src/services/paymentService');

      if (booking.payment.method === 'card' && booking.payment.tranzilaIndex) {
        await PaymentService.refundPayment(
          booking.payment.intentId,
          booking.payment.tranzilaIndex,
          'Client cancelled'
        );
      } else if (booking.payment.method === 'bit' && booking.payment.bitTransactionId) {
        await PaymentService.refundBitPayment(
          booking.payment.bitTransactionId,
          booking.payment.amount
        );
      }

      booking.payment.status     = 'refunded';
      booking.payment.refundedAt = new Date();
    }

    booking.status = 'cancelled';
    await booking.save();

    res.status(200).json({ success: true, message: 'Réservation annulée', data: booking });
  } catch (error) {
    console.error('Erreur cancelBooking:', error);
    res.status(500).json({ success: false, message: "Erreur lors de l'annulation" });
  }
});

// ✅ Compléter une réservation
router.patch('/:id/complete', protect, authorize('client'), async (req, res) => {
  try {
    const booking = await Request.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
    }

    if (booking.client.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé - seul le client peut compléter la réservation'
      });
    }

    if (!['accepted', 'confirmed', 'pending'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `La réservation ne peut pas être complétée (statut actuel: ${booking.status})`
      });
    }

    await booking.markAsCompleted();
    console.log(`✅ Booking ${req.params.id} completed by client ${req.user.id} at ${booking.completedAt}`);

    res.status(200).json({ success: true, message: 'Réservation complétée', data: booking });
  } catch (error) {
    console.error('Erreur completeBooking:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la complétion' });
  }
});

// ══════════════════════════════════════════════════════
// PAIEMENTS - CARTE DE CRÉDIT
// ══════════════════════════════════════════════════════

// ✅ NOUVELLE route principale utilisée par le frontend
router.post('/payments/card/charge', protect, authorize('client'), paymentController.createPaymentIntent);

// ✅ Rétrocompatibilité (ancien nom)
router.post('/payments/create-intent', protect, authorize('client'), paymentController.createPaymentIntent);

// Frais & statut
router.post('/payments/calculate-fees', paymentController.calculateFees);
router.get('/payments/status/:intentId', protect, paymentController.getPaymentStatus);

// Capture et remboursement (provider)
router.post('/payments/capture/:requestId', protect, authorize('provider'), paymentController.capturePayment);
router.post('/payments/refund/:requestId',  protect, authorize('provider'), paymentController.refundPayment);

// ══════════════════════════════════════════════════════
// PAIEMENTS - BIT
// ══════════════════════════════════════════════════════

router.post('/payments/bit/init',    protect, authorize('client'), paymentController.initBitPayment);
router.get('/payments/bit/success',  paymentController.bitSuccess);
router.get('/payments/bit/failure',  paymentController.bitFailure);
router.post('/payments/bit/notify',  paymentController.bitNotify); // webhook Tranzila

module.exports = router;