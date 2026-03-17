// models/User.js
// ✅ CE FICHIER EST DÉJÀ CORRECT

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const AddressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  zipCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    default: 'Israël'
  },
  isDefault: {
    type: Boolean,
    default: false
  }
});

const UserSchema = new mongoose.Schema({
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
  // Champs address et city pour la compatibilité avec le frontend
  address: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['client'],
    default: 'client'
  },
  addresses: [AddressSchema],
  // Vidéo de la propriété
  propertyVideo: {
    url: {
      type: String,
      default: null
    },
    publicId: {
      type: String,
      default: null
    },
    uploadedAt: {
      type: Date,
      default: null
    }
  },
  language: {
    type: String,
    enum: ['fr', 'en', 'he', 'ar'],
    default: 'he'
  },
  // Token pour les notifications push
  pushToken: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hacher le mot de passe avant l'enregistrement
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Vérifier le mot de passe
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ CORRECT : Génération JWT avec 'role'
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },  // ✅ Déjà correct
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

module.exports = mongoose.model('User', UserSchema);