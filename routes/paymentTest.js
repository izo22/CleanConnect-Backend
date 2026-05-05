// routes/paymentTest.js
// ✅ Page de test paiement pour review Tranzila — sans auth

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');

const PUBLIC_KEY    = process.env.TRANZILA_PUBLIC_KEY;
const SECRET_KEY    = process.env.TRANZILA_SECRET_KEY;
const TERMINAL_NAME = process.env.TRANZILA_TERMINAL_NAME;

function buildAuthHeaders() {
  const time  = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(40).toString('hex');
  const hash  = crypto
    .createHmac('sha256', SECRET_KEY + time + nonce)
    .update(PUBLIC_KEY)
    .digest('hex');
  return {
    'Content-Type':                'application/json',
    'X-tranzila-api-app-key':      PUBLIC_KEY,
    'X-tranzila-api-request-time': String(time),
    'X-tranzila-api-nonce':        nonce,
    'X-tranzila-api-access-token': hash
  };
}

// ── GET /payment-test ── Sert la page HTML ────────────────────────────────────
router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CleanConnect — דף תשלום</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: #2563EB;
      --primary-light: #EFF6FF;
      --success: #10B981;
      --error: #EF4444;
      --gray-50: #F9FAFB;
      --gray-100: #F3F4F6;
      --gray-300: #D1D5DB;
      --gray-500: #6B7280;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    body {
      font-family: 'Heebo', sans-serif;
      background: var(--gray-50);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .card {
      background: #fff;
      border-radius: 16px;
      border: 1px solid var(--gray-100);
      padding: 40px;
      width: 100%;
      max-width: 480px;
    }

    .logo-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
    }

    .logo-icon {
      width: 40px; height: 40px;
      background: var(--primary);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }

    .logo-text {
      font-size: 18px;
      font-weight: 700;
      color: var(--gray-900);
    }

    .logo-sub {
      font-size: 12px;
      color: var(--gray-500);
      font-weight: 400;
    }

    .amount-box {
      background: var(--primary-light);
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .amount-label { font-size: 13px; color: var(--gray-500); }
    .amount-value { font-size: 22px; font-weight: 700; color: var(--primary); }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--gray-500);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }

    .field { margin-bottom: 16px; }

    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--gray-700);
      margin-bottom: 6px;
    }

    input {
      width: 100%;
      height: 44px;
      border: 1px solid var(--gray-300);
      border-radius: 8px;
      padding: 0 14px;
      font-size: 14px;
      font-family: 'Heebo', sans-serif;
      color: var(--gray-900);
      outline: none;
      transition: border-color 0.15s;
      text-align: right;
      direction: ltr;
    }

    input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px #2563eb18; }
    input.error { border-color: var(--error); }

    .row { display: flex; gap: 12px; }
    .row .field { flex: 1; }

    .test-badge {
      background: #FFF7ED;
      border: 1px solid #FED7AA;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;
      color: #92400E;
      margin-bottom: 20px;
      text-align: center;
    }

    button {
      width: 100%;
      height: 48px;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      font-family: 'Heebo', sans-serif;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
      margin-top: 8px;
    }

    button:hover { background: #1d4ed8; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }

    .security {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 14px;
      font-size: 12px;
      color: var(--gray-500);
    }

    .result {
      margin-top: 20px;
      padding: 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      display: none;
    }

    .result.success { background: #ECFDF5; color: #065F46; }
    .result.error   { background: #FEF2F2; color: #991B1B; }

    .spinner {
      display: inline-block;
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-left: 8px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">

    <div class="logo-row">
      <div class="logo-icon">🧹</div>
      <div>
        <div class="logo-text">CleanConnect</div>
        <div class="logo-sub">שירותי ניקיון מקצועיים</div>
      </div>
    </div>

    <div class="amount-box">
      <span class="amount-label">עמלת שירות</span>
      <span class="amount-value">₪19.90</span>
    </div>

    <div class="test-badge">
      🧪 דף בדיקה — לשימוש Tranzila בלבד
    </div>

    <div class="section-title">פרטי כרטיס אשראי</div>

    <div class="field">
      <label>שם בעל הכרטיס</label>
      <input type="text" id="holdername" placeholder="ישראל ישראלי" />
    </div>

    <div class="field">
      <label>מספר כרטיס</label>
      <input type="text" id="ccno" placeholder="1234 5678 9012 3456" maxlength="19" />
    </div>

    <div class="row">
      <div class="field">
        <label>תוקף (MM/YY)</label>
        <input type="text" id="expiry" placeholder="12/26" maxlength="5" />
      </div>
      <div class="field">
        <label>CVV</label>
        <input type="text" id="cvv" placeholder="123" maxlength="4" />
      </div>
    </div>

    <button id="payBtn" onclick="handlePay()">
      שלם ₪19.90
    </button>

    <div class="security">
      🔒 תשלום מאובטח ומוצפן — Tranzila
    </div>

    <div class="result" id="result"></div>
  </div>

  <script>
    // Format card number
    document.getElementById('ccno').addEventListener('input', function() {
      let v = this.value.replace(/\\D/g, '').substring(0, 16);
      this.value = v.match(/.{1,4}/g)?.join(' ') || v;
    });

    // Format expiry
    document.getElementById('expiry').addEventListener('input', function() {
      let v = this.value.replace(/\\D/g, '');
      if (v.length > 2) v = v.substring(0,2) + '/' + v.substring(2,4);
      this.value = v;
    });

    async function handlePay() {
      const btn = document.getElementById('payBtn');
      const result = document.getElementById('result');
      const expiry = document.getElementById('expiry').value.split('/');

      const payload = {
        ccno:       document.getElementById('ccno').value.replace(/\\s/g, ''),
        expmonth:   expiry[0],
        expyear:    '20' + (expiry[1] || ''),
        cvv:        document.getElementById('cvv').value,
        holdername: document.getElementById('holdername').value,
      };

      // Basic validation
      if (!payload.ccno || payload.ccno.length < 13) {
        showResult('מספר כרטיס לא תקין', false); return;
      }
      if (!payload.expmonth || !expiry[1]) {
        showResult('תאריך תפוגה לא תקין', false); return;
      }
      if (!payload.cvv || payload.cvv.length < 3) {
        showResult('CVV לא תקין', false); return;
      }

      btn.disabled = true;
      btn.innerHTML = 'מעבד תשלום <span class="spinner"></span>';
      result.style.display = 'none';

      try {
        const res = await fetch('/payment-test/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          showResult('✅ התשלום בוצע בהצלחה! מזהה עסקה: ' + data.transactionId, true);
        } else {
          showResult('❌ ' + (data.message || 'התשלום נכשל'), false);
        }
      } catch(e) {
        showResult('❌ שגיאת רשת — נסה שנית', false);
      }

      btn.disabled = false;
      btn.innerHTML = 'שלם ₪19.90';
    }

    function showResult(msg, success) {
      const el = document.getElementById('result');
      el.textContent = msg;
      el.className = 'result ' + (success ? 'success' : 'error');
      el.style.display = 'block';
    }
  </script>
</body>
</html>`);
});

// ── POST /payment-test/charge ── Appel Tranzila sans auth ─────────────────────
router.post('/charge', async (req, res) => {
  const { ccno, expmonth, expyear, cvv, holdername } = req.body;

  if (!ccno || !expmonth || !expyear || !cvv) {
    return res.status(400).json({ success: false, message: 'פרטי כרטיס חסרים' });
  }

  try {
    const headers = buildAuthHeaders();
    const payload = {
      terminal_name: TERMINAL_NAME,
      txn_type:      'debit',
      card_number:   ccno,
      expire_month:  parseInt(expmonth),
      expire_year:   parseInt(expyear) % 100,
      cvv:           String(cvv),
      items: [{
        name:         'דמי תיווך CleanConnect',
        type:         'I',
        unit_price:   19.90,
        units_number: 1,
      }]
    };

    const response = await axios.post(
      'https://api.tranzila.com/v1/transaction/credit_card/create',
      payload,
      { headers, timeout: 15000 }
    );

    const data = response.data;
    const txn  = data.transaction_result;

    if (data.error_code !== 0 || !txn || txn.processor_response_code !== '000') {
      return res.status(400).json({
        success: false,
        message: 'הכרטיס נדחה (קוד: ' + (txn?.processor_response_code || data.error_code) + ')'
      });
    }

    return res.json({
      success:       true,
      transactionId: txn.transaction_id,
      authnumber:    txn.authentication_number,
    });

  } catch (err) {
    console.error('❌ [PAYMENT TEST] Erreur:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'שגיאה בעיבוד התשלום' });
  }
});

module.exports = router;