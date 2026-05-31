// src/services/notificationService.js
// ✅ VERSION CORRIGÉE : removeNotificationListeners utilise .remove() au lieu de
//    Notifications.removeNotificationSubscription() qui n'existe plus dans expo-notifications

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_URL } from '../config/constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
  }

  async registerForPushNotifications() {
    try {
      console.log('📱 Demande des permissions de notifications...');

      if (!Device.isDevice) {
        console.log('⚠️ Notifications push : appareil physique requis');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Permission notifications refusée');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      console.log('🔑 Project ID:', projectId);

      const tokenPromise = Notifications.getExpoPushTokenAsync({ projectId });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout push token après 5s')), 5000)
      );

      const token = (await Promise.race([tokenPromise, timeoutPromise])).data;
      console.log('✅ Push token obtenu:', token.substring(0, 30) + '...');

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }

      return token;
    } catch (error) {
      console.error('❌ Erreur registerForPushNotifications:', error.message);
      return null;
    }
  }

  async savePushTokenToServer(token) {
    try {
      const authToken = await AsyncStorage.getItem('token');

      if (!authToken) {
        console.warn('⚠️ savePushTokenToServer — token auth introuvable');
        return false;
      }

      console.log('💾 Enregistrement du push token sur le serveur...');

      const response = await axios.post(
        `${API_URL}/notifications/token`,
        { pushToken: token },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        console.log('✅ Push token enregistré sur le serveur');
        await AsyncStorage.setItem('pushToken', token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Erreur savePushTokenToServer:', error.response?.data || error.message);
      return false;
    }
  }

  async removePushTokenFromServer() {
    try {
      const authToken = await AsyncStorage.getItem('token');

      if (!authToken) return;

      console.log('🗑️ Suppression du push token...');

      await axios.delete(`${API_URL}/notifications/token`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      await AsyncStorage.removeItem('pushToken');
      console.log('✅ Push token supprimé');
    } catch (error) {
      console.error('❌ Erreur removePushTokenFromServer:', error.response?.data || error.message);
    }
  }

  setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification reçue:', notification);
      onNotificationReceived?.(notification);
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tappée:', response);
      const data = response.notification.request.content.data;
      onNotificationTapped?.(data);
    });
  }

  // ✅ CORRIGÉ : utilise .remove() sur la subscription directement
  removeNotificationListeners() {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  async getBadgeCount()       { return await Notifications.getBadgeCountAsync(); }
  async setBadgeCount(count)  { await Notifications.setBadgeCountAsync(count); }
  async clearBadge()          { await Notifications.setBadgeCountAsync(0); }

  async scheduleLocalNotification(title, body, data = {}) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true, badge: 1 },
      trigger: null,
    });
  }
}

export default new NotificationService();