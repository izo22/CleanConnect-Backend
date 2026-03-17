// backend/models/Request.js
// ✅ מודל עם ESCROW + ENUM בעברית + וידאו של הנכס + AIRBNB + AUTO-DELETE après 90 jours

const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: true
  },
  serviceType: {
    type: String,
    enum: ['בית', 'משרד', 'מעבר_דירה', 'ניקיון_גדול', 'בניין', 'אירבנב'], // ✅ עברית + Airbnb
    required: true
  },
  propertyType: {
    type: String,
    enum: ['דירה', 'בית_פרטי', 'משרד', 'חנות', 'בניין', 'אירבנב'],
    default: 'דירה'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    default: 2,
    min: 1
  },
  address: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending_payment', 'pending', 'accepted', 'declined', 'completed', 'cancelled', 'expired'],
    default: 'pending_payment'
  },
  
  // ✅ חדש: כתובת URL של וידאו הנכס של הלקוח
  propertyVideoUrl: {
    type: String,
    default: null
  },
  
  // ✅ ESCROW - מידע על התשלום
  payment: {
    intentId: {
      type: String,
      default: null
    },
    // ✅ AJOUT: Index Tranzila pour capture/annulation carte
    tranzilaIndex: {
      type: String,
      default: null
    },
    // ✅ AJOUT: Numéro d'autorisation carte
    authnumber: {
      type: String,
      default: null
    },
    // ✅ AJOUT: Transaction ID Bit (pour remboursement Bit)
    bitTransactionId: {
      type: Number,
      default: null
    },
    // ✅ AJOUT: Méthode de paiement utilisée
    method: {
      type: String,
      enum: ['card', 'bit', null],
      default: null
    },
    status: {
      type: String,
      enum: ['held', 'captured', 'refunded', 'failed'],
      default: 'held'
    },
    amount: {
      type: Number,
      default: 0
    },
    paidAt: {
      type: Date,
      default: null
    },
    capturedAt: {
      type: Date,
      default: null
    },
    refundedAt: {
      type: Date,
      default: null
    }
  },
  
  // ✅ ESCROW - נראות מספר טלפון של הספק
  providerPhoneVisible: {
    type: Boolean,
    default: false
  },
  
  // תאריכים
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date,
    default: null
  },
  // ✅ NOUVEAU: Date de complétion pour auto-suppression après 90 jours
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// אינדקסים לאופטימיזציה של שאילתות
requestSchema.index({ client: 1, createdAt: -1 });
requestSchema.index({ provider: 1, status: 1 });
requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ 'payment.status': 1, createdAt: -1 });
// ✅ Index pour le nettoyage automatique
requestSchema.index({ status: 1, completedAt: 1 });

// Middleware לעדכון updatedAt
requestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ✅ מתודה ללכידת תשלום (אישור) - Capture carte Tranzila
requestSchema.methods.capturePayment = async function() {
  const PaymentService = require('../services/paymentService');

  if (this.payment.method === 'card' && this.payment.tranzilaIndex) {
    const result = await PaymentService.capturePayment(
      this.payment.intentId,
      this.payment.tranzilaIndex
    );
    if (!result.success) throw new Error('CAPTURE_FAILED');
  }
  // Bit: pas de capture, le paiement est immédiat à l'init

  this.payment.status = 'captured';
  this.payment.capturedAt = new Date();
  this.providerPhoneVisible = true;
  this.status = 'accepted';
  this.respondedAt = new Date();
  return this.save();
};

// ✅ מתודה להחזר כספי (סירוב) - Remboursement carte OU Bit
requestSchema.methods.refundPayment = async function() {
  const PaymentService = require('../services/paymentService');

  if (this.payment.method === 'card' && this.payment.tranzilaIndex) {
    // Remboursement carte
    const result = await PaymentService.refundPayment(
      this.payment.intentId,
      this.payment.tranzilaIndex,
      'Provider declined'
    );
    if (!result.success) throw new Error('REFUND_FAILED');

  } else if (this.payment.method === 'bit' && this.payment.bitTransactionId) {
    // Remboursement Bit - le client reçoit un SMS
    const result = await PaymentService.refundBitPayment(
      this.payment.bitTransactionId,
      this.payment.amount
    );
    if (!result.success) throw new Error('REFUND_FAILED');
  }

  this.payment.status = 'refunded';
  this.payment.refundedAt = new Date();
  this.providerPhoneVisible = false;
  this.status = 'declined';
  this.respondedAt = new Date();
  return this.save();
};

// ✅ NOUVEAU: Méthode pour marquer comme complété
requestSchema.methods.markAsCompleted = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;