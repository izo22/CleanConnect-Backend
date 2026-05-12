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

// ══════════════════════════════════════════════════════
// ANNULATION CLIENT — Option A
// ✅ Uniquement si status === 'pending' (prestataire pas encore répondu)
// ✅ Remboursement 100% systématique (carte ou Bit)
// ✅ Une fois accepté, le numéro du prestataire est débloqué
//    → l'annulation se gère directement entre client et prestataire (CGU)
// ══════════════════════════════════════════════════════

router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Request.findById(req.params.id);

    // Réservation introuvable
    if (!booking) {
      return res.status(404).json({ success: false, message: 'הזמנה לא נמצאה' });
    }

    // Seul le client propriétaire peut annuler
    if (booking.client.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'אין הרשאה לביטול הזמנה זו' });
    }

    // ✅ Annulation autorisée uniquement en statut 'pending'
    // En 'accepted' → le prestataire a confirmé et son numéro est débloqué
    //                 → le client s'arrange directement avec lui (CGU)
    if (booking.status !== 'pending') {
      const messages = {
        accepted:  'לאחר אישור הספק, יש לפנות אליו ישירות לביטול',
        completed: 'לא ניתן לבטל הזמנה שהושלמה',
        cancelled: 'ההזמנה כבר בוטלה',
        declined:  'ההזמנה כבר נדחתה',
        expired:   'ההזמנה פגה',
      };
      return res.status(400).json({
        success: false,
        message: messages[booking.status] || 'לא ניתן לבטל הזמנה זו'
      });
    }

    // ✅ Remboursement 100% — carte ou Bit
    if (booking.payment?.status === 'held') {
      const PaymentService = require('../src/services/paymentService');

      if (booking.payment.method === 'card' && booking.payment.tranzilaIndex) {
        console.log('↩️  Remboursement carte pour annulation client:', booking._id);
        const refundResult = await PaymentService.refundPayment(
          booking.payment.intentId,
          booking.payment.tranzilaIndex,
          'Client cancelled - pending status'
        );

        if (!refundResult.success) {
          // ✅ On log l'erreur sans bloquer l'annulation
          // Le remboursement manuel sera tracé via payment.refundError
          console.error('⚠️  Remboursement Tranzila échoué:', refundResult);
          booking.payment.refundError = refundResult.message || 'Remboursement échoué';
        } else {
          booking.payment.status     = 'refunded';
          booking.payment.refundedAt = new Date();
        }

      } else if (booking.payment.method === 'bit' && booking.payment.bitTransactionId) {
        console.log('↩️  Remboursement Bit pour annulation client:', booking._id);
        const refundResult = await PaymentService.refundBitPayment(
          booking.payment.bitTransactionId,
          booking.payment.amount
        );

        if (!refundResult.success) {
          console.error('⚠️  Remboursement Bit échoué:', refundResult);
          booking.payment.refundError = refundResult.message || 'Remboursement Bit échoué';
        } else {
          booking.payment.status     = 'refunded';
          booking.payment.refundedAt = new Date();
        }
      }
    }

    booking.status = 'cancelled';
    await booking.save();

    console.log('✅ Réservation annulée par le client:', booking._id);

    res.status(200).json({
      success: true,
      message: 'ההזמנה בוטלה והכסף יוחזר תוך 3-5 ימי עסקים',
      data: {
        bookingId:     booking._id,
        status:        booking.status,
        paymentStatus: booking.payment.status,
        refundedAt:    booking.payment.refundedAt,
        refundError:   booking.payment.refundError || null,
      }
    });

  } catch (error) {
    console.error('❌ Erreur cancelBooking:', error);
    res.status(500).json({ success: false, message: 'שגיאה בביטול ההזמנה' });
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

router.post('/payments/card/charge',    protect, authorize('client'), paymentController.createPaymentIntent);
router.post('/payments/create-intent',  protect, authorize('client'), paymentController.createPaymentIntent);
router.post('/payments/calculate-fees', paymentController.calculateFees);
router.get('/payments/status/:intentId', protect, paymentController.getPaymentStatus);
router.post('/payments/capture/:requestId', protect, authorize('provider'), paymentController.capturePayment);
router.post('/payments/refund/:requestId',  protect, authorize('provider'), paymentController.refundPayment);

// ══════════════════════════════════════════════════════
// PAIEMENTS - BIT
// ══════════════════════════════════════════════════════

router.post('/payments/bit/init',   protect, authorize('client'), paymentController.initBitPayment);
router.get('/payments/bit/success', paymentController.bitSuccess);
router.get('/payments/bit/failure', paymentController.bitFailure);
router.post('/payments/bit/notify', paymentController.bitNotify);

module.exports = router;