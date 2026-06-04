// src/services/notificationService.js (BACKEND)
// ✅ Service notifications côté serveur — zéro dépendance Expo/React Native
// Envoie des push notifications via l'API HTTP Expo

const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Envoie une notification push via l'API Expo
 */
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken) {
    console.log('⚠️ sendPushNotification — pas de push token');
    return false;
  }

  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      badge: 1,
    };

    const response = await axios.post(EXPO_PUSH_URL, message, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Notification envoyée:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi notification:', error.message);
    return false;
  }
};

/**
 * Notifie le prestataire d'une nouvelle réservation
 */
const notifyProviderNewBooking = async (pushToken, bookingData) => {
  const { clientName, serviceType, scheduledDate, price, bookingId } = bookingData;

  const date = new Date(scheduledDate);
  const dateStr = date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return sendPushNotification(
    pushToken,
    '📋 הזמנה חדשה!',
    `${clientName} הזמין ${serviceType} ב-${dateStr} — ₪${price}`,
    { type: 'new_booking', bookingId }
  );
};

/**
 * Notifie le client que le prestataire a accepté
 */
const notifyClientBookingAccepted = async (pushToken, bookingData) => {
  const { providerName, serviceType, scheduledDate, bookingId } = bookingData;

  const date = new Date(scheduledDate);
  const dateStr = date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return sendPushNotification(
    pushToken,
    '✅ ההזמנה אושרה!',
    `${providerName} אישר את ${serviceType} ב-${dateStr}`,
    { type: 'booking_accepted', bookingId }
  );
};

/**
 * Notifie le client que le prestataire a refusé
 */
const notifyClientBookingDeclined = async (pushToken, bookingData) => {
  const { providerName, serviceType, bookingId } = bookingData;

  return sendPushNotification(
    pushToken,
    '❌ ההזמנה נדחתה',
    `${providerName} לא יכול לבצע את ${serviceType}`,
    { type: 'booking_declined', bookingId }
  );
};

module.exports = {
  sendPushNotification,
  notifyProviderNewBooking,
  notifyClientBookingAccepted,
  notifyClientBookingDeclined,
};