// backend/models/Request.js
// ✅ מודל עם ESCROW + ENUM בעברית + וידאו של הנכס + AIRBNB + AUTO-DELETE après 90 jours + PREMIÈRE COMMANDE GRATUITE

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
    enum: ['בית', 'משרד', 'מעבר_דירה', 'ניקיון_גדול', 'בניין', 'אירבנב'],
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
    tranzilaIndex: {
      type: String,
      default: null
    },
    authnumber: {
      type: String,
      default: null
    },
    bitTransactionId: {
      type: Number,
      default: null
    },
    // ✅ AJOUT 'free' pour première commande gratuite
    method: {
      type: String,
      enum: ['card', 'bit', 'free', null],
      default: null
    },
    // ✅ AJOUT 'free' pour première commande gratuite
    status: {
      type: String,
      enum: ['held', 'captured', 'refunded', 'failed', 'free'],
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

  providerPhoneVisible: {
    type: Boolean,
    default: false
  },

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
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

requestSchema.index({ client: 1, createdAt: -1 });
requestSchema.index({ provider: 1, status: 1 });
requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ 'payment.status': 1, createdAt: -1 });
requestSchema.index({ status: 1, completedAt: 1 });

requestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ✅ Capture paiement (carte uniquement — free et bit n'ont pas de capture)
requestSchema.methods.capturePayment = async function() {
  const PaymentService = require('../services/paymentService');

  if (this.payment.method === 'card' && this.payment.tranzilaIndex) {
    const result = await PaymentService.capturePayment(
      this.payment.intentId,
      this.payment.tranzilaIndex
    );
    if (!result.success) throw new Error('CAPTURE_FAILED');
  }
  // Bit et free : pas de capture nécessaire

  this.payment.status = this.payment.method === 'free' ? 'free' : 'captured';
  this.payment.capturedAt = new Date();
  this.providerPhoneVisible = true;
  this.status = 'accepted';
  this.respondedAt = new Date();
  return this.save();
};

// ✅ Remboursement (carte et bit uniquement — free : rien à rembourser)
requestSchema.methods.refundPayment = async function() {
  const PaymentService = require('../services/paymentService');

  if (this.payment.method === 'card' && this.payment.tranzilaIndex) {
    const result = await PaymentService.refundPayment(
      this.payment.intentId,
      this.payment.tranzilaIndex,
      'Provider declined'
    );
    if (!result.success) throw new Error('REFUND_FAILED');

  } else if (this.payment.method === 'bit' && this.payment.bitTransactionId) {
    const result = await PaymentService.refundBitPayment(
      this.payment.bitTransactionId,
      this.payment.amount
    );
    if (!result.success) throw new Error('REFUND_FAILED');
  }
  // free : rien à rembourser

  this.payment.status = this.payment.method === 'free' ? 'free' : 'refunded';
  this.payment.refundedAt = new Date();
  this.providerPhoneVisible = false;
  this.status = 'declined';
  this.respondedAt = new Date();
  return this.save();
};

requestSchema.methods.markAsCompleted = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;