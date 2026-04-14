// middleware/auth.js — Firebase Auth + Demo Mode
// RULE: User can only login if their email EXISTS in the USER table

const admin = require('../config/firebase');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // === DEMO MODE (no Firebase service key) ===
        if (!admin.apps || admin.apps.length === 0) {
            const demoEmail = req.headers['x-demo-user-email'] || 'arjun@mail.com';
            const [rows] = await db.query(
                'SELECT * FROM vw_user_wallet WHERE Email = ?', [demoEmail]
            );
            if (rows.length === 0) {
                return res.status(403).json({ error: 'Email not registered in wallet system. Ask admin to add your email first.' });
            }
            req.user = rows[0];
            return next();
        }

        // === FIREBASE MODE ===
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);

        // Check if this email exists in our USER table
        let [rows] = await db.query(
            'SELECT * FROM vw_user_wallet WHERE Email = ?', [decoded.email]
        );

        // If not found by email, try by firebase_uid
        if (rows.length === 0) {
            [rows] = await db.query(
                'SELECT * FROM vw_user_wallet WHERE firebase_uid = ?', [decoded.uid]
            );
        }

        if (rows.length === 0) {
            return res.status(403).json({
                error: 'Email not registered — please Sign Up first',
                email: decoded.email
            });
        }

        // Link firebase_uid if not yet linked
        if (!rows[0].firebase_uid) {
            await db.query(
                'UPDATE `USER` SET firebase_uid = ? WHERE Email = ?',
                [decoded.uid, decoded.email]
            );
        }

        req.user = rows[0];
        next();

    } catch (err) {
        console.error('Auth error:', err.message);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

module.exports = authMiddleware;
