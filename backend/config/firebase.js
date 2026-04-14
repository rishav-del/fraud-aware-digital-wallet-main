const admin = require('firebase-admin');
const path = require('path');

try {
    const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized');
} catch (err) {
    console.warn('⚠️  Firebase Admin NOT initialized (serviceAccountKey.json missing)');
    console.warn('   The app will run in DEMO MODE — no token verification');
}

module.exports = admin;
