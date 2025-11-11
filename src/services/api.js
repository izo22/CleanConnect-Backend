// src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_URL } from '@env';

// Créer une instance axios avec la configuration de base
const api = axios.create({
  baseURL: Platform.OS === 'web' 
    ? 'http://localhost:5000/api'  // Pour le web
    : API_URL || 'http://10.0.2.2:5000/api', // Pour mobile
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 secondes maximum pour la requête
});

// Intercepteur pour ajouter le token d'authentification et journaliser les requêtes
api.interceptors.request.use(
  async (config) => {
    console.log('Requête envoyée à :', config.url, 'avec les données :', config.data);
    
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Erreur de requête :', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour journaliser les réponses
api.interceptors.response.use(
  response => {
    console.log('Réponse reçue de :', response.config.url, 'statut :', response.status);
    return response;
  },
  error => {
    console.error('Erreur de réponse :', error.message);
    if (error.response) {
      console.error('Statut :', error.response.status);
      console.error('Données d\'erreur :', error.response.data);
    } else if (error.request) {
      console.error('Pas de réponse reçue, problème de réseau probable');
    }
    return Promise.reject(error);
  }
);


// Service d'authentification
export const authService = {
  // Inscription d'un client
  registerClient: async (userData) => {
    try {
      const response = await api.post('/auth/register/client', userData);
      if (response.data.token) {
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('userRole', 'client');
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Inscription d'un prestataire
  registerProvider: async (providerData) => {
    try {
      const response = await api.post('/auth/register/provider', providerData);
      if (response.data.token) {
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('userRole', 'provider');
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.provider));
      }
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Connexion (client ou prestataire)
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      if (response.data.token) {
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('userRole', response.data.user.role);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Déconnexion
  logout: async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userData');
      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  // Obtenir les informations de l'utilisateur connecté
  getMe: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
};

// Service utilisateur (client)
export const userService = {
  // Mettre à jour les informations personnelles
  updateProfile: async (userData) => {
    try {
      const response = await api.put('/users/profile', userData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Ajouter une adresse
  addAddress: async (addressData) => {
    try {
      const response = await api.post('/users/addresses', addressData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Mettre à jour une adresse
  updateAddress: async (addressId, addressData) => {
    try {
      const response = await api.put(`/users/addresses/${addressId}`, addressData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Supprimer une adresse
  deleteAddress: async (addressId) => {
    try {
      const response = await api.delete(`/users/addresses/${addressId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
};

// Service prestataire
// Service prestataire
export const providerService = {
  // Obtenir le profil du prestataire
  getProviderProfile: async () => {
    try {
      const response = await api.get('/providers/profile');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Mettre à jour le profil du prestataire
  updateProfile: async (providerData) => {
    try {
      const response = await api.put('/providers/profile', providerData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Mettre à jour la photo de profil
  updateProfileImage: async (imageData) => {
    try {
      const formData = new FormData();
      formData.append('profileImage', imageData);
      
      const response = await api.post('/providers/profile/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
  
  // Ajouter un nouveau service
  addService: async (serviceData) => {
    try {
      const response = await api.post('/providers/services', serviceData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
  
  // Mettre à jour un service existant
  updateService: async (serviceId, serviceData) => {
    try {
      const response = await api.put(`/providers/services/${serviceId}`, serviceData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
  
  // Supprimer un service
  deleteService: async (serviceId) => {
    try {
      const response = await api.delete(`/providers/services/${serviceId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Mettre à jour les disponibilités
  updateAvailability: async (availabilityData) => {
    try {
      const response = await api.put('/providers/availability', availabilityData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
  
  // Obtenir les zones de service
  getServiceAreas: async () => {
    try {
      const response = await api.get('/providers/service-areas');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
  
  // Mettre à jour les zones de service
  updateServiceAreas: async (areasData) => {
    try {
      const response = await api.put('/providers/service-areas', areasData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Obtenir la liste des missions
  getJobs: async (filters = {}) => {
    try {
      const response = await api.get('/providers/jobs', { params: filters });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Obtenir les détails d'une mission
  getJobDetails: async (jobId) => {
    try {
      const response = await api.get(`/providers/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Accepter une mission
  acceptJob: async (jobId) => {
    try {
      const response = await api.put(`/providers/jobs/${jobId}/accept`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Refuser une mission
  declineJob: async (jobId) => {
    try {
      const response = await api.put(`/providers/jobs/${jobId}/decline`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Marquer une mission comme terminée
  completeJob: async (jobId) => {
    try {
      const response = await api.put(`/providers/jobs/${jobId}/complete`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
  
  // Obtenir les avis clients
  getReviews: async () => {
    try {
      const response = await api.get('/providers/reviews');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
  
  // Mettre à jour l'expérience et les certifications
  updateExperience: async (experienceData) => {
    try {
      const response = await api.put('/providers/experience', experienceData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
  
  // Mettre à jour les informations de contact
  updateContact: async (contactData) => {
    try {
      const response = await api.put('/providers/contact', contactData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }
};

// Service de réservation
export const bookingService = {
  // Rechercher des prestataires disponibles
  searchProviders: async (searchParams) => {
    try {
      const response = await api.get('/bookings/search-providers', { params: searchParams });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Créer une nouvelle réservation
  createBooking: async (bookingData) => {
    try {
      const response = await api.post('/bookings', bookingData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Obtenir les détails d'une réservation
  getBookingDetails: async (bookingId) => {
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Obtenir l'historique des réservations du client
  getClientBookings: async (status) => {
    try {
      const response = await api.get('/bookings/client', { params: { status } });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Annuler une réservation
  cancelBooking: async (bookingId) => {
    try {
      const response = await api.put(`/bookings/${bookingId}/cancel`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Soumettre une évaluation pour une réservation
  submitReview: async (bookingId, reviewData) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/review`, reviewData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
};

export default api;