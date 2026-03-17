// backend/models/Provider.js
// ✅ CORRIGÉ : suppression de l'index compound sur deux arrays (serviceAreas + serviceTypes)

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const providerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Le numéro de téléphone est requis']
  },

  serviceTypes: {
    type: [{
      type: String,
      enum: ['בית', 'משרד', 'בניין', 'אירבנב'],
    }],
    required: [true, 'Au moins un type de service est requis'],
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'Au moins un type de service doit être sélectionné'
    }
  },

  serviceAreas: {
    type: [{
      type: String,
      trim: true
    }],
    required: [true, 'Au moins une zone de service est requise'],
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'Au moins une ville doit être sélectionnée pour les zones de service'
    }
  },

  serviceDetails: [{
    type: {
      type: String,
      enum: ['בית', 'משרד', 'בניין', 'אירבנב'],
      required: true
    },
    hourlyRate: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      default: '',
      maxlength: 500
    }
  }],

  bio: {
    type: String,
    default: '',
    maxlength: 500
  },

  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },

  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },

  availability: [{
    id: {
      type: String,
      required: true
    },
    date: {
      type: String,
      required: false
    },
    dayOfWeek: {
      type: Number,
      required: false,
      min: 0,
      max: 6
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['available', 'booked'],
      default: 'available'
    }
  }],

  languages: [{
    type: String,
    enum: ['hebrew', 'arabic', 'english', 'french', 'russian', 'amharic']
  }],

  verified: {
    type: Boolean,
    default: false
  },

  active: {
    type: Boolean,
    default: true
  },

  role: {
    type: String,
    enum: ['provider'],
    default: 'provider'
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  lastLoginAt: {
    type: Date,
    default: null
  },

  pushToken: {
    type: String,
    default: null
  },

  hourlyRate: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// ✅ Index email unique uniquement
providerSchema.index({ email: 1 }, { unique: true });

// ✅ Index SÉPARÉS pour les deux arrays (jamais compound entre deux arrays)
providerSchema.index({ serviceAreas: 1 });
providerSchema.index({ serviceTypes: 1 });

// ✅ Méthode statique pour supprimer l'ancien index compound problématique
providerSchema.statics.cleanupIndexes = async function() {
  try {
    const indexes = await this.collection.indexes();
    for (const index of indexes) {
      const keys = Object.keys(index.key);
      if (keys.includes('serviceAreas') && keys.includes('serviceTypes')) {
        await this.collection.dropIndex(index.name);
        console.log('✅ Ancien index compound supprimé :', index.name);
      }
    }
  } catch (err) {
    if (err.code !== 27) {
      console.warn('⚠️ cleanupIndexes warning:', err.message);
    }
  }
};

// Hasher le mot de passe avant sauvegarde
providerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Comparer les mots de passe
providerSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Erreur lors de la comparaison des mots de passe');
  }
};

// Génération JWT
providerSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: 'provider' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// Infos publiques
providerSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    phone: this.phone,
    serviceTypes: this.serviceTypes,
    serviceAreas: this.serviceAreas,
    serviceDetails: this.serviceDetails,
    bio: this.bio,
    rating: this.rating,
    reviewCount: this.reviewCount,
    availability: this.availability,
    languages: this.languages,
    verified: this.verified,
    active: this.active,
    role: this.role,
    hourlyRate: this.hourlyRate
  };
};

const Provider = mongoose.model('Provider', providerSchema, 'fournisseurs');

// ✅ Nettoyage automatique au démarrage du serveur
mongoose.connection.once('open', () => {
  Provider.cleanupIndexes();
});

module.exports = Provider;