/* ============================================================
   config.js — Application Configuration
   ============================================================ */

// API base URL — auto-detects if served from Express or opened as file
const API_BASE = window.location.protocol === 'file:'
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

// Firebase configuration — REPLACE with your project's config
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDt4kwPE_yZZtZ8cnd5udfQ89pP4Tj5Les",
    authDomain: "fraud-aware-digital-wallet.firebaseapp.com",
    projectId: "fraud-aware-digital-wallet",
};

// App constants
const FRAUD_THRESHOLD = 70;        // Score above this = flagged
const MAX_TRANSFER = 500000;       // ₹5,00,000 max single transfer
const MAX_TOPUP = 100000;          // ₹1,00,000 max add money
const TOAST_DURATION = 3500;       // ms
