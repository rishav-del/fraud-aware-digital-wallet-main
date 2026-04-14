// routes/api.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const walletCtrl = require('../controllers/walletController');
const txnCtrl = require('../controllers/transactionController');
const fraudCtrl = require('../controllers/fraudController');
const db = require('../config/db');

// Check if email exists in DB
router.post('/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });
        const [rows] = await db.query('SELECT User_ID, Name, Email FROM `USER` WHERE Email = ?', [email]);
        if (rows.length === 0) {
            return res.json({ exists: false, message: 'Email not registered' });
        }
        return res.json({ exists: true, name: rows[0].Name });
    } catch (err) {
        res.status(500).json({ error: 'Check failed' });
    }
});

// Auto-register new user — creates USER + WALLET in MySQL
router.post('/register', async (req, res) => {
    try {
        const { email, name, firebase_uid } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        // Check if already exists
        const [existing] = await db.query('SELECT User_ID FROM `USER` WHERE Email = ?', [email]);
        if (existing.length > 0) {
            return res.json({ status: 'exists', message: 'User already registered' });
        }

        // Generate unique IDs
        const [[maxUser]] = await db.query("SELECT MAX(CAST(SUBSTRING(User_ID, 2) AS UNSIGNED)) AS max_id FROM `USER`");
        const nextUserId = 'U' + String((maxUser.max_id || 0) + 1).padStart(3, '0');

        const [[maxWallet]] = await db.query("SELECT MAX(CAST(SUBSTRING(Wallet_ID, 2) AS UNSIGNED)) AS max_id FROM WALLET");
        const nextWalletId = 'W' + String((maxWallet.max_id || 0) + 1).padStart(3, '0');

        // Extract name from email if not provided
        const userName = name || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        // Insert USER
        await db.query(
            'INSERT INTO `USER` (User_ID, firebase_uid, Name, Email, Account_Status) VALUES (?, ?, ?, ?, ?)',
            [nextUserId, firebase_uid || null, userName, email, 'Active']
        );

        // Create WALLET with ₹10,000 starting balance (for demo)
        await db.query(
            'INSERT INTO WALLET (Wallet_ID, Balance, Wallet_Status, User_ID) VALUES (?, ?, ?, ?)',
            [nextWalletId, 10000.00, 'Active', nextUserId]
        );

        console.log(`✅ New user registered: ${userName} (${email}) → ${nextUserId} / ${nextWalletId}`);

        res.json({
            status: 'created',
            message: `Welcome ${userName}! Account created with ₹10,000 starting balance.`,
            user: { User_ID: nextUserId, Name: userName, Email: email },
            wallet: { Wallet_ID: nextWalletId, Balance: 10000.00 }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

router.get('/wallet', auth, walletCtrl.getWallet);
router.get('/wallet/stats', auth, walletCtrl.getStats);
router.post('/add-money', auth, walletCtrl.addMoney);
router.post('/send-money', auth, txnCtrl.sendMoney);
router.get('/transactions', auth, txnCtrl.getTransactions);
router.get('/fraud-alerts', auth, fraudCtrl.getAlerts);
router.post('/fraud-check', auth, fraudCtrl.fraudCheck);
router.post('/fraud-alerts/:id/resolve', auth, fraudCtrl.resolveAlert);

module.exports = router;
