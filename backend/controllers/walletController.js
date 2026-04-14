// controllers/walletController.js — Wallet Operations
// DBMS Concepts: Stored procedures, ACID transactions

const db = require('../config/db');

// GET /api/wallet — returns current user's wallet info
exports.getWallet = async (req, res) => {
    try {
        const { User_ID, Name, Email, Wallet_ID, Balance, Wallet_Status } = req.user;
        res.json({
            user: { User_ID, Name, Email },
            wallet: { Wallet_ID, Balance: parseFloat(Balance), Wallet_Status }
        });
    } catch (err) {
        console.error('getWallet error:', err);
        res.status(500).json({ error: 'Failed to fetch wallet' });
    }
};

// GET /api/wallet/stats — dashboard stats (sent, received, alerts)
exports.getStats = async (req, res) => {
    try {
        const wid = req.user.Wallet_ID;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Total sent this month
        const [sent] = await db.query(
            `SELECT COALESCE(SUM(Amount),0) AS total FROM TRANSACTION
             WHERE Sender_Wallet_ID = ? AND Txn_Status = 'Success'
             AND Txn_Time >= ?`, [wid, startOfMonth]
        );

        // Total received this month
        const [recv] = await db.query(
            `SELECT COALESCE(SUM(Amount),0) AS total FROM TRANSACTION
             WHERE Receiver_Wallet_ID = ? AND Txn_Status = 'Success'
             AND Txn_Time >= ?`, [wid, startOfMonth]
        );

        // Active fraud alerts for this user's transactions
        const [alerts] = await db.query(
            `SELECT COUNT(*) AS count FROM FRAUD_ALERT fa
             JOIN TRANSACTION t ON fa.Txn_ID = t.Txn_ID
             WHERE (t.Sender_Wallet_ID = ? OR t.Receiver_Wallet_ID = ?)
             AND fa.Alert_Status = 'Open'`, [wid, wid]
        );

        res.json({
            sent_this_month: parseFloat(sent[0].total),
            received_this_month: parseFloat(recv[0].total),
            active_alerts: alerts[0].count
        });
    } catch (err) {
        console.error('getStats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

// POST /api/add-money — add funds to wallet (simulated)
// Uses stored procedure sp_add_money for ACID compliance
exports.addMoney = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }
        if (amount > 100000) {
            return res.status(400).json({ error: 'Maximum top-up is ₹1,00,000' });
        }

        const wid = req.user.Wallet_ID;

        // Call stored procedure — DBMS concept: encapsulated transaction logic
        const [result] = await db.query(
            'CALL sp_add_money(?, ?, @status, @message)',
            [wid, amount]
        );
        const [[output]] = await db.query('SELECT @status AS status, @message AS message');

        if (output.status !== 'Success') {
            return res.status(400).json({ error: output.message });
        }

        // Fetch updated balance
        const [[wallet]] = await db.query(
            'SELECT Balance FROM WALLET WHERE Wallet_ID = ?', [wid]
        );

        res.json({
            status: output.status,
            message: output.message,
            new_balance: parseFloat(wallet.Balance)
        });
    } catch (err) {
        console.error('addMoney error:', err);
        res.status(500).json({ error: 'Failed to add money' });
    }
};
