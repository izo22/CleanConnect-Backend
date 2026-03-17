// services/paymentService.js
// ✅ Intégration Tranzila - Carte de crédit + Bit - HMAC-SHA256

const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');

// ─── Endpoints ────────────────────────────────────────────────────────────────
const TRANZILA_CARD_API = 'https://api.tranzila.com/v1/transaction/credit_card/create';
const TRANZILA_CGI_API  = 'https://secure5.tranzila.com/cgi-bin/tranzila31.cgi';
const TRANZILA_BIT_API  = 'https://api.tranzila.com';

const PUBLIC_KEY    = process.env.TRANZILA_PUBLIC_KEY;
const SECRET_KEY    = process.env.TRANZILA_SECRET_KEY;
const TERMINAL_NAME = process.env.TRANZILA_TERMINAL_NAME;
const TERMINAL_PW   = process.env.TRANZILA_TERMINAL_PW;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function buildAuthHeaders() {
  const time  = Math.floor(Date.now() / 1000); // ✅ secondes Unix comme PHP time()
  const nonce = crypto.randomBytes(40).toString('hex'); // ✅ 40 bytes = 80 chars
  const hash  = crypto
    .createHmac('sha256', SECRET_KEY + time + nonce)    // ✅ clé = secret + time + nonce
    .update(PUBLIC_KEY)                                  // ✅ message = PUBLIC_KEY seulement
    .digest('hex');

  return {
    'Content-Type':                 'application/json',
    'X-tranzila-api-app-key':       PUBLIC_KEY,
    'X-tranzila-api-request-time':  String(time),
    'X-tranzila-api-nonce':         nonce,
    'X-tranzila-api-access-token':  hash
  };
}

// ─── Payment Service ──────────────────────────────────────────────────────────

class PaymentService {

  // ══════════════════════════════════════════════════════
  // CARTE DE CRÉDIT
  // ══════════════════════════════════════════════════════

  static async createPaymentIntent({ amount, currency = 'ILS', metadata = {}, cardDetails }) {
    try {
      console.log('💳 [TRANZILA] Création pre-auth carte...');

      if (!cardDetails || !cardDetails.ccno) {
        throw new Error('MISSING_CARD_DETAILS');
      }

      const headers = buildAuthHeaders();

      const payload = {
        terminal_name:  TERMINAL_NAME,
        txn_type:       'auth',
        card_number:    cardDetails.ccno,
        expire_month:   parseInt(cardDetails.expmonth),
        expire_year:    parseInt(cardDetails.expyear) % 100,
        cvv:            String(cardDetails.mycvv),
        items: [{
          name:         'דמי תיווך CleanConnect',
          type:         'I',
          unit_price:   parseFloat(amount),
          units_number: 1,
        }],
        user_defined_fields: [
          { name: 'clientId',  value: metadata.clientId  || '' },
          { name: 'bookingId', value: metadata.bookingId || '' },
        ]
      };

      console.log('📤 [TRANZILA] Payload:', JSON.stringify(payload));

      const response = await axios.post(TRANZILA_CARD_API, payload, {
        headers,
        timeout: 15000
      });

      const data = response.data;
      console.log('🔍 [TRANZILA] Réponse pre-auth:', JSON.stringify(data));

      const txn = data.transaction_result;

      if (data.error_code !== 0 || !txn || txn.processor_response_code !== '000') {
        const errorCode = txn?.processor_response_code || data.error_code;
        return {
          success:   false,
          error:     'CARD_DECLINED',
          errorCode,
          message:   getTranzilaErrorMessage(String(errorCode))
        };
      }

      const intentId = `trz_${txn.transaction_id}_${txn.authentication_number || Date.now()}`;
      console.log('✅ [TRANZILA] Pre-auth réussie:', intentId);

      return {
        success: true,
        paymentIntent: {
          id:               intentId,
          tranzilaIndex:    txn.transaction_id,
          authnumber:       txn.authentication_number,
          confirmationCode: txn.processor_response_code,
          amount:           Math.round(amount * 100),
          currency:         'ils',
          status:           'requires_capture',
          method:           'card',
          metadata,
          created:          new Date().toISOString(),
          captureMethod:    'manual'
        }
      };

    } catch (error) {
      console.error('❌ [TRANZILA] Erreur pre-auth:', error.response?.data || error.message);
      if (error.message === 'MISSING_CARD_DETAILS') {
        return { success: false, error: 'MISSING_CARD_DETAILS', message: 'פרטי כרטיס אשראי חסרים' };
      }
      return { success: false, error: 'PAYMENT_ERROR', message: 'שגיאה בעיבוד התשלום' };
    }
  }

  /**
   * Capture carte (débiter après service rendu)
   */
  static async capturePayment(intentId, tranzilaIndex) {
    try {
      console.log('💰 [TRANZILA] Capture carte:', intentId);
      if (!tranzilaIndex) throw new Error('MISSING_TRANZILA_INDEX');

      const payload = qs.stringify({
        supplier:   TERMINAL_NAME,
        TranzilaPW: TERMINAL_PW,
        tranmode:   'F',
        index:      tranzilaIndex,
      });

      const response = await axios.post(TRANZILA_CGI_API, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });

      const data = qs.parse(response.data);
      console.log('🔍 [TRANZILA] Réponse capture:', data);

      if (data.Response !== '000') {
        return {
          success:   false,
          error:     'CAPTURE_FAILED',
          errorCode: data.Response,
          message:   'לא ניתן לחייב את הכרטיס'
        };
      }

      console.log('✅ [TRANZILA] Carte capturée');
      return {
        success: true,
        capture: {
          id:               intentId,
          tranzilaIndex,
          confirmationCode: data.ConfirmationCode,
          status:           'succeeded',
          captured:         true,
          capturedAt:       new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ [TRANZILA] Erreur capture:', error.message);
      return { success: false, error: 'CAPTURE_FAILED', message: 'לא ניתן לחייב את הכרטיס' };
    }
  }

  /**
   * Remboursement / annulation carte
   */
  static async refundPayment(intentId, tranzilaIndex, reason = 'Provider declined') {
    try {
      console.log('↩️  [TRANZILA] Remboursement carte:', intentId);
      if (!tranzilaIndex) throw new Error('MISSING_TRANZILA_INDEX');

      const payload = qs.stringify({
        supplier:   TERMINAL_NAME,
        TranzilaPW: TERMINAL_PW,
        tranmode:   'C',
        index:      tranzilaIndex,
        remarks:    reason,
      });

      const response = await axios.post(TRANZILA_CGI_API, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });

      const data = qs.parse(response.data);
      console.log('🔍 [TRANZILA] Réponse annulation:', data);

      if (data.Response !== '000') {
        return {
          success:   false,
          error:     'REFUND_FAILED',
          errorCode: data.Response,
          message:   'שגיאה בהחזר כספי'
        };
      }

      console.log('✅ [TRANZILA] Remboursement carte effectué');
      return {
        success: true,
        refund: {
          id:               `ref_${data.index || Date.now()}`,
          paymentIntentId:  intentId,
          confirmationCode: data.ConfirmationCode,
          status:           'succeeded',
          reason,
          refundedAt:       new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ [TRANZILA] Erreur remboursement:', error.message);
      return { success: false, error: 'REFUND_FAILED', message: 'שגיאה בהחזר כספי' };
    }
  }

  // ══════════════════════════════════════════════════════
  // BIT
  // ══════════════════════════════════════════════════════

  static async initBitPayment({ amount, metadata = {}, clientInfo = {} }) {
    try {
      console.log('📱 [TRANZILA BIT] Init paiement Bit...');

      const headers = buildAuthHeaders();
      const payload = {
        terminal_name:     TERMINAL_NAME,
        txn_currency_code: 'ILS',
        txn_type:          'debit',
        success_url:       `${process.env.API_BASE_URL}/api/bookings/payments/bit/success`,
        failure_url:       `${process.env.API_BASE_URL}/api/bookings/payments/bit/failure`,
        notify_url:        `${process.env.API_BASE_URL}/api/bookings/payments/bit/notify`,
        response_language: 'hebrew',
        client: {
          name:  clientInfo.name  || '',
          email: clientInfo.email || '',
          id:    clientInfo.id    || '',
        },
        items: [{
          name:                          metadata.serviceName || 'דמי תיווך CleanConnect',
          type:                          'I',
          units_number:                  1,
          unit_type:                     1,
          unit_price:                    parseFloat(amount),
          price_type:                    'G',
          currency_code:                 'ILS',
          to_txn_currency_exchange_rate: 1,
          vat_percent:                   0,
        }],
        user_defined_fields: [
          { name: 'bookingId', value: metadata.bookingId || '' },
          { name: 'clientId',  value: metadata.clientId  || '' },
        ]
      };

      const response = await axios.post(
        `${TRANZILA_BIT_API}/v1/transaction/bit/init`,
        payload,
        { headers, timeout: 15000 }
      );
      const data = response.data;
      console.log('🔍 [TRANZILA BIT] Réponse init:', data);

      if (data.error_code) {
        return {
          success:   false,
          error:     'BIT_INIT_FAILED',
          errorCode: data.error_code,
          message:   data.message || 'שגיאה באתחול Bit'
        };
      }

      console.log('✅ [TRANZILA BIT] URL générée:', data.sale_url);
      return {
        success:       true,
        saleUrl:       data.sale_url,
        transactionId: data.transaction_id,
        method:        'bit'
      };

    } catch (error) {
      console.error('❌ [TRANZILA BIT] Erreur init:', error.message);
      return { success: false, error: 'BIT_INIT_FAILED', message: 'שגיאה בתשלום Bit' };
    }
  }

  static async refundBitPayment(transactionId, amount) {
    try {
      console.log('↩️  [TRANZILA BIT] Remboursement Bit:', transactionId);
      if (!transactionId) throw new Error('MISSING_TRANSACTION_ID');

      const headers = buildAuthHeaders();
      const payload = {
        terminal_name:  TERMINAL_NAME,
        transaction_id: transactionId,
        amount:         parseFloat(amount),
      };

      const response = await axios.post(
        `${TRANZILA_BIT_API}/v1/transaction/bit/refund`,
        payload,
        { headers, timeout: 15000 }
      );
      const data = response.data;
      console.log('🔍 [TRANZILA BIT] Réponse remboursement:', data);

      if (data.error_code) {
        const errorMessages = {
          20106: 'כבר בוצע החזר',
          20107: 'שגיאה בהחזר כספי',
          20109: 'סכום ההחזר גבוה מהסכום המקורי',
          20110: 'העסקה לא נמצאה',
        };
        return {
          success:   false,
          error:     'BIT_REFUND_FAILED',
          errorCode: data.error_code,
          message:   errorMessages[data.error_code] || 'שגיאה בהחזר Bit'
        };
      }

      console.log('✅ [TRANZILA BIT] Remboursement Bit effectué');
      return {
        success: true,
        refund: {
          transactionId,
          amount,
          status:     'succeeded',
          refundedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ [TRANZILA BIT] Erreur remboursement:', error.message);
      return { success: false, error: 'BIT_REFUND_FAILED', message: 'שגיאה בהחזר Bit' };
    }
  }

  // ══════════════════════════════════════════════════════
  // STATUT
  // ══════════════════════════════════════════════════════

  static async getPaymentStatus(intentId, tranzilaIndex) {
    try {
      console.log('🔍 [TRANZILA] Vérification statut:', intentId);
      if (!tranzilaIndex) {
        return { success: true, status: 'requires_capture', id: intentId };
      }

      const payload = qs.stringify({
        supplier:   TERMINAL_NAME,
        TranzilaPW: TERMINAL_PW,
        tranmode:   'Q',
        index:      tranzilaIndex,
      });

      const response = await axios.post(TRANZILA_CGI_API, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });
      const data = qs.parse(response.data);

      return {
        success: true,
        status:  data.Response === '000' ? 'requires_capture' : 'failed',
        id:      intentId,
        raw:     data
      };

    } catch (error) {
      console.error('❌ [TRANZILA] Erreur status:', error.message);
      return { success: false, error: 'STATUS_CHECK_FAILED' };
    }
  }

  // ══════════════════════════════════════════════════════
  // FRAIS PLATEFORME
  // ══════════════════════════════════════════════════════

  static calculatePlatformFee(servicePrice, serviceType = 'appart-prive') {
    const FIXED_FEE     = parseFloat(process.env.PLATFORM_FEE_FIXED || 10);
    const PREMIUM_TYPES = ['airbnb', 'immeuble', 'bureaux'];
    const PERCENTAGE    = PREMIUM_TYPES.includes(serviceType) ? 6 : 3;
    const percentageFee = (servicePrice * PERCENTAGE) / 100;
    const totalFee      = FIXED_FEE + percentageFee;

    return {
      fixedFee:      FIXED_FEE,
      percentageFee: parseFloat(percentageFee.toFixed(2)),
      totalFee:      parseFloat(totalFee.toFixed(2)),
      percentage:    PERCENTAGE,
      serviceType,
      currency:      'ILS'
    };
  }
}

// ─── Codes d'erreur carte ─────────────────────────────────────────────────────

function getTranzilaErrorMessage(code) {
  const errors = {
    '001': 'הכרטיס נדחה על ידי חברת האשראי',
    '002': 'הכרטיס גנוב',
    '003': 'יש לפנות לחברת האשראי',
    '004': 'הכרטיס נדחה',
    '006': 'שגיאה. אנא נסה שנית',
    '033': 'הכרטיס פג תוקף',
    '036': 'הכרטיס חסום',
    '039': 'מספר כרטיס שגוי',
    '051': 'אין מסגרת מספיקה',
    '057': 'הכרטיס אינו מורשה לסוג עסקה זה',
    '065': 'חריגה ממגבלת עסקאות',
    '141': 'המסוף אינו מופעל לעסקאות כרטיס אשראי',
  };
  return errors[code] || `שגיאה בתשלום (קוד: ${code})`;
}

module.exports = PaymentService;