// models/Provider.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const AvailabilitySchema = new mongoose.Schema({
  day: {
    type: Number, // 0 = Dimanche, 1 = Lundi, etc.
    required: true
  },
  startTime: {
    type: String, // format "HH:MM"
    required: true
  },
  endTime: {
    type: String, // format "HH:MM"
    required: true
  }
});

// Nouveau schéma pour les détails de service
const ServiceDetailSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['maison', 'immeuble', 'bureau', 'autre'],
    required: true
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    default: ''
  }
});

const ProviderSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Veuillez fournir un email valide']
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['provider'],
    default: 'provider'
  },
  serviceTypes: {
    type: [{
      type: String,
      enum: ['maison', 'immeuble', 'bureau', 'autre']
    }],
    required: true
  },
  // Nouveau champ pour les détails de services avec taux horaires spécifiques
  serviceDetails: [ServiceDetailSchema],
  serviceAreas: {
    type: [String],
    required: true
  },
  hourlyRate: {
    type: Number,
    required: true
  },
  availability: [AvailabilitySchema],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      text: String,
      rating: Number,
      date: {
        type: Date,
        default: Date.now
      }
    }
  ],
  language: {
    type: String,
    enum: ['fr', 'en', 'he', 'ar'],
    default: 'he'
  },
  profileImage: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  experience: {
    type: Number, // Années d'expérience
    default: 0
  },
  certifications: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
});

// Middleware pour mettre à jour le taux horaire moyen avant la sauvegarde
ProviderSchema.pre('save', async function(next) {
  // Si serviceDetails existe et a des éléments, calculer le taux horaire moyen
  if (this.serviceDetails && this.serviceDetails.length > 0) {
    const total = this.serviceDetails.reduce((sum, service) => sum + service.hourlyRate, 0);
    this.hourlyRate = parseFloat((total / this.serviceDetails.length).toFixed(2));
  }
  next();
});

// Hacher le mot de passe avant l'enregistrement
ProviderSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Méthode pour calculer le tarif d'un service
ProviderSchema.methods.calculateServicePrice = function(serviceType, hours) {
  // Trouver le détail du service
  const serviceDetail = this.serviceDetails.find(service => service.type === serviceType);
  if (!serviceDetail) {
    return this.hourlyRate * hours; // Utiliser le taux par défaut si détail non trouvé
  }
  return serviceDetail.hourlyRate * hours;
};

// Vérifier le mot de passe
ProviderSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Générer un JWT
// ✅ CORRECTION : Ajout du fallback '30d' pour éviter l'erreur expiresIn
ProviderSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' } // ✅ MODIFIÉ ICI
  );
};

module.exports = mongoose.model('Provider', ProviderSchema);