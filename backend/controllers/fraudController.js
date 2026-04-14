// controllers/fraudController.js — Fraud Alerts & Manual Fraud Check
const db = require('../config/db');
const axios = require('axios');

// GET /api/fraud-alerts — list fraud alerts for current user
exports.getAlerts = async (req, res) => {
    try {
        const wid = req.user.Wallet_ID;
        const [rows] = await db.query(
            `SELECT fa.Alert_ID, fa.Alert_Type, fa.Risk_Score, fa.Alert_Time,
                    fa.Alert_Status, t.Txn_ID, t.Amount, t.Txn_Time, t.Txn_Status,
                    ur.Name AS Receiver_Name, ur.Email AS Receiver_Email,
                    us.Name AS Sender_Name
             FROM FRAUD_ALERT fa
             JOIN TRANSACTION t ON fa.Txn_ID = t.Txn_ID
             LEFT JOIN WALLET wr ON t.Receiver_Wallet_ID = wr.Wallet_ID
             LEFT JOIN \`USER\` ur ON wr.User_ID = ur.User_ID
             LEFT JOIN WALLET ws ON t.Sender_Wallet_ID = ws.Wallet_ID
             LEFT JOIN \`USER\` us ON ws.User_ID = us.User_ID
             WHERE t.Sender_Wallet_ID = ? OR t.Receiver_Wallet_ID = ?
             ORDER BY fa.Alert_Time DESC`,
            [wid, wid]
        );

        const alerts = rows.map(r => ({
            alert_id: r.Alert_ID,
            type: r.Alert_Type,
            risk_score: parseFloat(r.Risk_Score),
            time: r.Alert_Time,
            status: r.Alert_Status,
            severity: parseFloat(r.Risk_Score) >= 80 ? 'critical' : 'warning',
            transaction: {
                txn_id: r.Txn_ID,
                amount: parseFloat(r.Amount),
                time: r.Txn_Time,
                status: r.Txn_Status,
                receiver_name: r.Receiver_Name,
                sender_name: r.Sender_Name
            }
        }));

        res.json({ alerts });
    } catch (err) {
        console.error('getAlerts error:', err);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
};

// POST /api/fraud-check — manually check a hypothetical transaction
exports.fraudCheck = async (req, res) => {
    try {
        const { amount, recipient_email } = req.body;
        if (!amount) return res.status(400).json({ error: 'Amount required' });

        const features = {
            amount: parseFloat(amount),
            sender_txn_count_1h: 0,
            sender_txn_count_24h: 0,
            sender_avg_amount: 0,
            amount_deviation: 0,
            is_new_receiver: recipient_email ? 1 : 0,
            hour_of_day: new Date().getHours(),
            is_night_transaction: (new Date().getHours() >= 23 || new Date().getHours() <= 5) ? 1 : 0,
            device_is_trusted: 1,
            sender_account_age_days: 30
        };

        let result;
        try {
            const mlResponse = await axios.post(
                `${process.env.FRAUD_API_URL || 'http://localhost:5001'}/predict`,
                features,
                { timeout: 5000 }
            );
            result = mlResponse.data;
        } catch {
            // Fallback rule-based
            let score = 0;
            if (amount >= 50000) score = 85;
            else if (amount >= 10000) score = 45;
            else if (amount >= 5000) score = 20;
            else score = 5;
            result = { fraud_score: score, is_fraud: score >= 70, label: score >= 70 ? 'FRAUD' : 'LEGITIMATE' };
        }

        res.json({
            fraud_score: result.fraud_score,
            is_fraud: result.is_fraud,
            label: result.label || (result.is_fraud ? 'FRAUD' : 'LEGITIMATE'),
            features
        });
    } catch (err) {
        console.error('fraudCheck error:', err);
        res.status(500).json({ error: 'Fraud check failed' });
    }
};

// POST /api/fraud-alerts/:id/resolve — mark alert as reviewed/closed
exports.resolveAlert = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'block' | 'safe'

        const newStatus = action === 'block' ? 'Reviewed' : 'Closed';

        await db.query(
            'UPDATE FRAUD_ALERT SET Alert_Status = ? WHERE Alert_ID = ?',
            [newStatus, id]
        );

        // If blocking, also block the transaction
        if (action === 'block') {
            const [[alert]] = await db.query(
                'SELECT Txn_ID FROM FRAUD_ALERT WHERE Alert_ID = ?', [id]
            );
            if (alert) {
                await db.query(
                    'UPDATE TRANSACTION SET Txn_Status = ? WHERE Txn_ID = ?',
                    ['Blocked', alert.Txn_ID]
                );
            }
        }

        res.json({ status: 'ok', alert_status: newStatus });
    } catch (err) {
        console.error('resolveAlert error:', err);
        res.status(500).json({ error: 'Failed to resolve alert' });
    }
};
