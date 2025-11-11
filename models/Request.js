// models/Request.js
const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
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
    required: true,
    enum: ['maison', 'bureau', 'immeuble']
  },
  propertyType: {
    type: String,
    required: true,
    enum: ['maison', 'appartement', 'bureau']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'accepted', 'declined', 'completed', 'cancelled'],
    default: 'pending'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  price: {
    type: Number
  },
  declineReason: {
    type: String
  },
  completionNotes: {
    type: String
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Request', RequestSchema);