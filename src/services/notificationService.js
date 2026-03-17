// services/notificationService.js
// ✅ Service de notifications push avec Expo

const { Expo } = require('expo-server-sdk');

class NotificationService {
  constructor() {
    this.expo = new Expo();
  }

  /**
   * Envoyer une notification à un utilisateur
   * @param {String} pushToken - Token Expo du destinataire
   * @param {Object} notification - Contenu de la notification
   * @returns {Promise}
   */
  async sendNotification(pushToken, notification) {
    try {
      // Vérifier que le token est valide
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error('❌ Token push invalide:', pushToken);
        return { success: false, error: 'Token invalide' };
      }

      const message = {
        to: pushToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        badge: notification.badge || 1,
        priority: 'high',
        channelId: 'default'
      };

      console.log('📤 Envoi notification:', {
        to: pushToken.substring(0, 20) + '...',
        title: notification.title
      });

      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('❌ Erreur envoi chunk:', error);
        }
      }

      console.log('✅ Notification envoyée:', tickets);
      return { success: true, tickets };

    } catch (error) {
      console.error('❌ Erreur sendNotification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notification : Nouvelle demande de réservation pour le prestataire
   */
  async notifyProviderNewBooking(providerToken, bookingData) {
    const notification = {
      title: '🔔 בקשת הזמנה חדשה',
      body: `${bookingData.clientName} שלח/ה בקשה לשירות ${bookingData.serviceType}`,
      data: {
        type: 'NEW_BOOKING',
        bookingId: bookingData.bookingId,
        clientId: bookingData.clientId,
        serviceType: bookingData.serviceType,
        scheduledDate: bookingData.scheduledDate,
        price: bookingData.price
      },
      badge: 1
    };

    return this.sendNotification(providerToken, notification);
  }

  /**
   * Notification : Le prestataire a accepté la réservation
   */
  async notifyClientBookingAccepted(clientToken, bookingData) {
    const notification = {
      title: '✅ ההזמנה אושרה!',
      body: `${bookingData.providerName} אישר/ה את ההזמנה שלך`,
      data: {
        type: 'BOOKING_ACCEPTED',
        bookingId: bookingData.bookingId,
        providerId: bookingData.providerId,
        providerName: bookingData.providerName,
        providerPhone: bookingData.providerPhone,
        scheduledDate: bookingData.scheduledDate
      },
      badge: 1
    };

    return this.sendNotification(clientToken, notification);
  }

  /**
   * Notification : Le prestataire a refusé la réservation
   */
  async notifyClientBookingDeclined(clientToken, bookingData) {
    const notification = {
      title: '❌ ההזמנה נדחתה',
      body: `${bookingData.providerName} לא יכול/ה לקבל את ההזמנה שלך`,
      data: {
        type: 'BOOKING_DECLINED',
        bookingId: bookingData.bookingId,
        providerId: bookingData.providerId,
        providerName: bookingData.providerName
      },
      badge: 1
    };

    return this.sendNotification(clientToken, notification);
  }

  /**
   * Envoyer des notifications en masse
   * @param {Array} notifications - Array de {pushToken, notification}
   */
  async sendBulkNotifications(notifications) {
    const messages = notifications
      .filter(({ pushToken }) => Expo.isExpoPushToken(pushToken))
      .map(({ pushToken, notification }) => ({
        to: pushToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        badge: notification.badge || 1
      }));

    if (messages.length === 0) {
      console.log('⚠️ Aucune notification valide à envoyer');
      return { success: true, sent: 0 };
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('❌ Erreur envoi bulk:', error);
      }
    }

    console.log(`✅ ${messages.length} notifications envoyées`);
    return { success: true, sent: messages.length, tickets };
  }
}

module.exports = new NotificationService();