// controllers/paymentController.js
// ✅ Contrôleur paiement - Carte de crédit + Bit - Tranzila

const Request = require('../models/Request');
const PaymentService = require('../src/services/paymentService');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// ══════════════════════════════════════════════════════
// CARTE DE CRÉDIT
// ══════════════════════════════════════════════════════

/**
 * @desc    Charger une carte (pre-auth Tranzila)
 * @route   POST /api/bookings/payments/card/charge
 * @route   POST /api/bookings/payments/create-intent  (rétrocompat)
 * @access  Private (client)
 *
 * ✅ FIX: accepte les champs carte à plat (ccno, expmonth, expyear, cvv, holdername)
 *         au lieu du format nested { cardDetails: { ccno, mycvv, ... } }
 */
exports.createPaymentIntent = asyncHandler(async (req, res, next) => {
  const {
    amount,
    servicePrice,
    bookingId,
    serviceType,
    // ✅ Champs carte à plat (envoyés par le frontend)
    ccno,
    expmonth,
    expyear,
    cvv,
    holdername,
    // Rétrocompat : ancien format nested
    cardDetails: cardDetailsNested
  } = req.body;

  console.log('💳 Charge carte Tranzila...');
  console.log('   Amount:', amount, '| ServiceType:', serviceType, '| BookingId:', bookingId);

  if (!amount || amount <= 0) {
    return next(new ErrorResponse('Montant invalide', 400));
  }

  // ✅ Normaliser les champs carte : plat en priorité, nested en fallback
  const cardDetails = {
    ccno:      ccno      || cardDetailsNested?.ccno,
    expmonth:  expmonth  || cardDetailsNested?.expmonth,
    expyear:   expyear   || cardDetailsNested?.expyear,
    mycvv:     cvv       || cardDetailsNested?.mycvv,  // ✅ rename cvv → mycvv pour Tranzila
    holdername: holdername || cardDetailsNested?.holdername || '',
  };

  if (!cardDetails.ccno || !cardDetails.expmonth || !cardDetails.expyear || !cardDetails.mycvv) {
    return next(new ErrorResponse('פרטי כרטיס אשראי חסרים', 400));
  }

  try {
    const fees = PaymentService.calculatePlatformFee(servicePrice || 0, serviceType);
    console.log('   Fees:', fees);

    const result = await PaymentService.createPaymentIntent({
      amount: fees.totalFee,
      currency: 'ILS',
      metadata: {
        clientId: req.user.id,
        bookingId: bookingId || 'pending',
        servicePrice,
        serviceType,
        platformFee: fees.totalFee,
        percentage: fees.percentage
      },
      cardDetails
    });

    if (!result.success) {
      return next(new ErrorResponse(result.message || 'הכרטיס נדחה', 400));
    }

    // ✅ Sauvegarder tranzilaIndex + authnumber si la réservation existe déjà
    if (bookingId && bookingId !== 'pending') {
      const booking = await Request.findById(bookingId);
      if (booking) {
        booking.payment.intentId     = result.paymentIntent.id;
        booking.payment.tranzilaIndex = result.paymentIntent.tranzilaIndex;
        booking.payment.authnumber   = result.paymentIntent.authnumber;
        booking.payment.amount       = fees.totalFee;
        booking.payment.method       = 'card';
        booking.payment.status       = 'held';
        booking.payment.paidAt       = new Date();
        booking.status               = 'pending';
        await booking.save();
        console.log('✅ tranzilaIndex sauvegardé:', result.paymentIntent.tranzilaIndex);
      }
    }

    res.status(200).json({
      success: true,
      message: 'תשלום בוצע בהצלחה',
      data: {
        paymentIntentId:  result.paymentIntent.id,
        tranzilaIndex:    result.paymentIntent.tranzilaIndex,
        authnumber:       result.paymentIntent.authnumber,
        amount:           fees.totalFee,
        fees,
        status:           result.paymentIntent.status
      }
    });

  } catch (error) {
    console.error('❌ Erreur createPaymentIntent:', error);
    return next(new ErrorResponse('שגיאה בעיבוד התשלום', 500));
  }
});

/**
 * @desc    Capturer un paiement carte (prestataire accepte)
 * @route   POST /api/bookings/payments/capture/:requestId
 * @access  Private (provider)
 */
exports.capturePayment = asyncHandler(async (req, res, next) => {
  const { requestId } = req.params;
  console.log('💰 Capture paiement pour request:', requestId);

  const request = await Request.findById(requestId);
  if (!request) return next(new ErrorResponse('Demande non trouvée', 404));

  if (request.payment.status !== 'held') {
    return next(new ErrorResponse('Le paiement ne peut pas être capturé', 400));
  }

  const result = await PaymentService.capturePayment(
    request.payment.intentId,
    request.payment.tranzilaIndex
  );

  if (!result.success) {
    return next(new ErrorResponse(result.message || 'Échec de la capture', 400));
  }

  request.payment.status    = 'captured';
  request.payment.capturedAt = new Date();
  request.status             = 'accepted';
  request.providerPhoneVisible = true;
  await request.save();

  console.log('✅ Paiement capturé, demande acceptée');
  res.status(200).json({
    success: true,
    message: 'התשלום בוצע בהצלחה',
    data: {
      requestId:     request._id,
      paymentStatus: request.payment.status,
      status:        request.status
    }
  });
});

/**
 * @desc    Rembourser un paiement carte (prestataire refuse)
 * @route   POST /api/bookings/payments/refund/:requestId
 * @access  Private (provider)
 */
exports.refundPayment = asyncHandler(async (req, res, next) => {
  const { requestId } = req.params;
  const { reason } = req.body;
  console.log('↩️  Remboursement pour request:', requestId);

  const request = await Request.findById(requestId);
  if (!request) return next(new ErrorResponse('Demande non trouvée', 404));

  if (request.payment.status !== 'held' && request.payment.status !== 'captured') {
    return next(new ErrorResponse('Le paiement ne peut pas être remboursé', 400));
  }

  const result = await PaymentService.refundPayment(
    request.payment.intentId,
    request.payment.tranzilaIndex,
    reason || 'Provider declined request'
  );

  if (!result.success) {
    return next(new ErrorResponse(result.message || 'Échec du remboursement', 400));
  }

  request.payment.status    = 'refunded';
  request.payment.refundedAt = new Date();
  request.status             = 'declined';
  request.declineReason      = reason || 'Non spécifié';
  await request.save();

  console.log('✅ Paiement remboursé, demande refusée');
  res.status(200).json({
    success: true,
    message: 'הכסף הוחזר בהצלחה',
    data: {
      requestId:     request._id,
      paymentStatus: request.payment.status,
      status:        request.status
    }
  });
});

// ══════════════════════════════════════════════════════
// BIT
// ══════════════════════════════════════════════════════

/**
 * @desc    Initialiser un paiement Bit (retourne une URL WebView)
 * @route   POST /api/bookings/payments/bit/init
 * @access  Private (client)
 *
 * ✅ FIX: bookingId optionnel — Bit peut être initialisé AVANT la création
 *         de la réservation (le frontend crée la réservation après le callback)
 */
exports.initBitPayment = asyncHandler(async (req, res, next) => {
  const { amount, servicePrice, bookingId, serviceType } = req.body;

  console.log('📱 Init Bit | bookingId:', bookingId || 'pending');

  if (!servicePrice || servicePrice <= 0) {
    return next(new ErrorResponse('Prix du service invalide', 400));
  }

  try {
    const fees = PaymentService.calculatePlatformFee(servicePrice, serviceType);

    // ✅ FIX: infos client depuis req.user par défaut (bookingId optionnel)
    let clientName  = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    let clientEmail = req.user.email || '';

    // Si la réservation existe déjà, on enrichit avec ses données
    if (bookingId && bookingId !== 'pending') {
      const booking = await Request.findById(bookingId)
        .populate('client', 'firstName lastName email');
      if (booking?.client) {
        clientName  = `${booking.client.firstName} ${booking.client.lastName}`;
        clientEmail = booking.client.email;
      }
    }

    const result = await PaymentService.initBitPayment({
      amount: fees.totalFee,
      metadata: {
        bookingId:   bookingId || 'pending',
        clientId:    req.user.id,
        serviceName: `CleanConnect - ${serviceType || 'ניקיון'}`,
      },
      clientInfo: {
        name:  clientName,
        email: clientEmail,
        id:    req.user.id,
      }
    });

    if (!result.success) {
      return next(new ErrorResponse(result.message || 'שגיאה באתחול Bit', 400));
    }

    // ✅ Sauvegarder bitTransactionId si la réservation existe déjà
    if (bookingId && bookingId !== 'pending') {
      const booking = await Request.findById(bookingId);
      if (booking) {
        booking.payment.intentId         = `bit_${result.transactionId}`;
        booking.payment.bitTransactionId = result.transactionId;
        booking.payment.amount           = fees.totalFee;
        booking.payment.method           = 'bit';
        booking.payment.status           = 'held';
        booking.payment.paidAt           = new Date();
        booking.status                   = 'pending';
        await booking.save();
        console.log('✅ Bit initialisé, transactionId:', result.transactionId);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Bit initialisé',
      data: {
        saleUrl:       result.saleUrl,       // ← afficher dans WebView React Native
        requestId:     result.transactionId, // ← renommé requestId pour le frontend
        transactionId: result.transactionId,
        amount:        fees.totalFee,
        fees,
      }
    });

  } catch (error) {
    console.error('❌ Erreur initBitPayment:', error);
    return next(new ErrorResponse('שגיאה בתשלום Bit', 500));
  }
});

/**
 * @desc    Callback Bit - succès (appelé par Tranzila après paiement)
 * @route   GET /api/bookings/payments/bit/success
 * @access  Public (Tranzila callback)
 */
exports.bitSuccess = asyncHandler(async (req, res, next) => {
  console.log('✅ [BIT CALLBACK] Succès:', req.query);
  res.status(200).json({ success: true, message: 'תשלום Bit הצליח' });
});

/**
 * @desc    Callback Bit - échec (appelé par Tranzila après échec)
 * @route   GET /api/bookings/payments/bit/failure
 * @access  Public (Tranzila callback)
 */
exports.bitFailure = asyncHandler(async (req, res, next) => {
  console.log('❌ [BIT CALLBACK] Échec:', req.query);
  res.status(200).json({ success: false, message: 'תשלום Bit נכשל' });
});

/**
 * @desc    Notify Bit - webhook Tranzila (succès ou échec)
 * @route   POST /api/bookings/payments/bit/notify
 * @access  Public (Tranzila webhook)
 */
exports.bitNotify = asyncHandler(async (req, res, next) => {
  console.log('🔔 [BIT NOTIFY] Notification Tranzila:', req.body);

  const { transaction_id, status } = req.body;

  if (transaction_id) {
    const booking = await Request.findOne({ 'payment.bitTransactionId': transaction_id });
    if (booking) {
      if (status === 'success' || status === 'approved') {
        booking.payment.status = 'held';
        await booking.save();
        console.log('✅ [BIT NOTIFY] Paiement confirmé pour booking:', booking._id);
      } else {
        booking.payment.status = 'failed';
        booking.status         = 'cancelled';
        await booking.save();
        console.log('❌ [BIT NOTIFY] Paiement échoué pour booking:', booking._id);
      }
    }
  }

  res.status(200).json({ received: true });
});

// ══════════════════════════════════════════════════════
// COMMUN
// ══════════════════════════════════════════════════════

/**
 * @desc    Vérifier le statut d'un paiement
 * @route   GET /api/bookings/payments/status/:intentId
 * @access  Private
 */
exports.getPaymentStatus = asyncHandler(async (req, res, next) => {
  const { intentId } = req.params;

  const request = await Request.findOne({ 'payment.intentId': intentId });
  const tranzilaIndex = request?.payment?.tranzilaIndex || null;

  const result = await PaymentService.getPaymentStatus(intentId, tranzilaIndex);

  if (!result.success) {
    return next(new ErrorResponse('Impossible de vérifier le statut', 400));
  }

  res.status(200).json({ success: true, data: { intentId, status: result.status } });
});

/**
 * @desc    Calculer les frais de plateforme
 * @route   POST /api/bookings/payments/calculate-fees
 * @access  Public
 */
exports.calculateFees = asyncHandler(async (req, res, next) => {
  const { servicePrice, serviceType } = req.body;

  if (!servicePrice || servicePrice <= 0) {
    return next(new ErrorResponse('Prix du service invalide', 400));
  }

  const fees = PaymentService.calculatePlatformFee(servicePrice, serviceType);
  res.status(200).json({ success: true, data: fees });
});

module.exports = exports;