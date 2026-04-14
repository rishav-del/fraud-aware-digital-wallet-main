// controllers/transactionController.js — 15-Feature Dynamic Computation from MySQL
const db = require('../config/db');
const axios = require('axios');
const genTxnId = () => 'TXN' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase();

async function computeFeatures(senderWalletId, amount, receiverWalletId) {
    const now = new Date();
    const oneHourAgo = new Date(now - 3600000);
    const oneDayAgo = new Date(now - 86400000);
    const [[h1]] = await db.query('SELECT COUNT(*) AS c FROM TRANSACTION WHERE Sender_Wallet_ID=? AND Txn_Time>=?', [senderWalletId, oneHourAgo]);
    const [[h24]] = await db.query('SELECT COUNT(*) AS c FROM TRANSACTION WHERE Sender_Wallet_ID=? AND Txn_Time>=?', [senderWalletId, oneDayAgo]);
    const [[stats]] = await db.query('SELECT COALESCE(AVG(Amount),0) AS avg_amt, COALESCE(STDDEV(Amount),0) AS std_amt, COUNT(*) AS total FROM TRANSACTION WHERE Sender_Wallet_ID=?', [senderWalletId]);
    const [[recv]] = await db.query('SELECT COUNT(*) AS c FROM TRANSACTION WHERE Sender_Wallet_ID=? AND Receiver_Wallet_ID=?', [senderWalletId, receiverWalletId]);
    const [[age]] = await db.query('SELECT DATEDIFF(NOW(), Created_Date) AS days FROM WALLET WHERE Wallet_ID=?', [senderWalletId]);
    const [[device]] = await db.query('SELECT COALESCE(MAX(Is_Trusted),0) AS trusted FROM DEVICE d JOIN WALLET w ON d.User_ID=w.User_ID WHERE w.Wallet_ID=?', [senderWalletId]);
    const [[lastTxn]] = await db.query('SELECT TIMESTAMPDIFF(MINUTE, MAX(Txn_Time), NOW()) AS mins FROM TRANSACTION WHERE Sender_Wallet_ID=?', [senderWalletId]);
    const hour = now.getHours();
    const avgAmt = parseFloat(stats.avg_amt) || 0;
    const stdAmt = parseFloat(stats.std_amt) || 1;
    const totalTxns = parseInt(stats.total) || 0;
    const isNewReceiver = recv.c === 0 ? 1 : 0;
    const isNight = (hour >= 23 || hour <= 4) ? 1 : 0;
    const accountAge = age ? age.days : 0;
    const deviceTrusted = device.trusted ? 1 : 0;
    const txnCount1h = h1.c;
    const txnCount24h = h24.c;
    const timeSinceLast = lastTxn.mins !== null ? Math.max(lastTxn.mins, 0.5) : 999;
    let amountDev = totalTxns > 0 && stdAmt > 0 ? (amount - avgAmt) / stdAmt : amount / 2000;
    const amountToAvgRatio = avgAmt > 0 ? amount / avgAmt : amount / 1000;
    const txnVelocityScore = txnCount1h * 3 + txnCount24h * 0.5;
    const receiverRiskScore = isNewReceiver * (0.3 + (amount > 10000 ? 0.4 : 0) + (isNight ? 0.2 : 0));
    const amountRoundFlag = (amount % 1000 === 0 && amount >= 5000) ? 1 : 0;
    return {
        amount: parseFloat(amount), sender_txn_count_1h: txnCount1h, sender_txn_count_24h: txnCount24h,
        sender_avg_amount: avgAmt, amount_deviation: Math.round(amountDev * 100) / 100,
        is_new_receiver: isNewReceiver, hour_of_day: hour, is_night_transaction: isNight,
        device_is_trusted: deviceTrusted, sender_account_age_days: accountAge,
        amount_to_avg_ratio: Math.round(amountToAvgRatio * 100) / 100,
        txn_velocity_score: Math.round(txnVelocityScore * 100) / 100,
        receiver_risk_score: Math.round(receiverRiskScore * 100) / 100,
        amount_round_flag: amountRoundFlag,
        time_since_last_txn_minutes: Math.round(timeSinceLast * 10) / 10
    };
}

exports.sendMoney = async (req, res) => {
    try {
        const { recipient_email, amount, note } = req.body;
        if (!recipient_email) return res.status(400).json({ error: 'Recipient email required' });
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
        const senderWallet = req.user.Wallet_ID;
        const senderBalance = parseFloat(req.user.Balance);
        if (amount > senderBalance) return res.status(400).json({ error: 'Insufficient balance' });
        const [receivers] = await db.query('SELECT w.Wallet_ID, w.Wallet_Status, u.Name, u.Email FROM WALLET w JOIN `USER` u ON w.User_ID=u.User_ID WHERE u.Email=?', [recipient_email]);
        if (receivers.length === 0) return res.status(404).json({ error: 'Recipient not found' });
        const receiver = receivers[0];
        if (receiver.Wallet_ID === senderWallet) return res.status(400).json({ error: 'Cannot send to yourself' });
        const features = await computeFeatures(senderWallet, amount, receiver.Wallet_ID);
        let fraudScore = 0, isFlagged = false, riskLevel = 'LOW', riskFactors = [];
        try {
            const mlRes = await axios.post(`${process.env.FRAUD_API_URL || 'http://localhost:5001'}/predict`, features, { timeout: 5000 });
            fraudScore = mlRes.data.fraud_score || 0;
            isFlagged = mlRes.data.is_fraud || false;
            riskLevel = mlRes.data.risk_level || 'LOW';
            riskFactors = mlRes.data.risk_factors || [];
        } catch (mlErr) {
            console.warn('ML unavailable, using rules');
            fraudScore = 10;
            if (amount >= 50000) fraudScore += 30;
            if (features.sender_txn_count_1h >= 5) fraudScore += 25;
            if (features.is_night_transaction) fraudScore += 15;
            if (features.is_new_receiver) fraudScore += 10;
            if (features.sender_account_age_days < 7) fraudScore += 20;
            if (features.amount_to_avg_ratio > 5) fraudScore += 10;
            fraudScore = Math.min(fraudScore, 99);
            isFlagged = fraudScore >= 60;
            riskLevel = fraudScore >= 80 ? 'CRITICAL' : fraudScore >= 60 ? 'HIGH' : fraudScore >= 35 ? 'MEDIUM' : 'LOW';
        }
        const txnId = genTxnId();
        await db.query('CALL sp_send_money(?,?,?,?,?,?,?,@s,@m)', [txnId, senderWallet, receiver.Wallet_ID, amount, note||null, fraudScore, isFlagged]);
        const [[output]] = await db.query('SELECT @s AS status, @m AS message');
        try { await db.query('INSERT INTO TRANSACTION_FEATURES (Txn_ID,sender_txn_count_1h,sender_txn_count_24h,sender_avg_amount,amount_deviation,is_new_receiver,hour_of_day,is_night_transaction,device_is_trusted,sender_account_age_days) VALUES (?,?,?,?,?,?,?,?,?,?)', [txnId, features.sender_txn_count_1h, features.sender_txn_count_24h, features.sender_avg_amount, features.amount_deviation, features.is_new_receiver, features.hour_of_day, features.is_night_transaction, features.device_is_trusted, features.sender_account_age_days]); } catch(e) {}
        const [[wallet]] = await db.query('SELECT Balance FROM WALLET WHERE Wallet_ID=?', [senderWallet]);
        res.json({
            txn_id: txnId, status: output.status, message: output.message, amount: parseFloat(amount),
            recipient: { name: receiver.Name, email: receiver.Email },
            fraud: { score: fraudScore, is_flagged: isFlagged, risk_level: riskLevel, label: isFlagged ? 'FLAGGED' : 'CLEAR', risk_factors: riskFactors },
            features_used: {
                amount: features.amount, txns_last_1h: features.sender_txn_count_1h, txns_last_24h: features.sender_txn_count_24h,
                avg_amount: Math.round(features.sender_avg_amount), amount_deviation: features.amount_deviation + ' std devs',
                new_receiver: features.is_new_receiver === 1 ? 'Yes (first time)' : 'No (known)',
                time: features.hour_of_day + ':00 (' + (features.is_night_transaction ? 'Night' : 'Daytime') + ')',
                device_trusted: features.device_is_trusted === 1 ? 'Yes' : 'No',
                account_age: features.sender_account_age_days + ' days',
                amount_vs_avg: features.amount_to_avg_ratio + 'x your average',
                velocity: features.txn_velocity_score, time_since_last: features.time_since_last_txn_minutes + ' min ago'
            },
            new_balance: parseFloat(wallet.Balance)
        });
    } catch (err) { console.error('sendMoney error:', err); res.status(500).json({ error: 'Transaction failed' }); }
};

exports.getTransactions = async (req, res) => {
    try {
        const wid = req.user.Wallet_ID;
        const { filter, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE (t.Sender_Wallet_ID=? OR t.Receiver_Wallet_ID=?)';
        const params = [wid, wid];
        if (filter === 'sent') { where = 'WHERE t.Sender_Wallet_ID=?'; params.length = 0; params.push(wid); }
        else if (filter === 'received') { where = 'WHERE t.Receiver_Wallet_ID=?'; params.length = 0; params.push(wid); }
        else if (filter === 'flagged') { where += ' AND t.is_flagged=TRUE'; }
        const [rows] = await db.query(`SELECT t.Txn_ID,t.Amount,t.Txn_Type,t.Txn_Time,t.Txn_Status,t.fraud_score,t.is_flagged,t.description,t.Sender_Wallet_ID,t.Receiver_Wallet_ID,us.Name AS Sender_Name,us.Email AS Sender_Email,ur.Name AS Receiver_Name,ur.Email AS Receiver_Email FROM TRANSACTION t LEFT JOIN WALLET ws ON t.Sender_Wallet_ID=ws.Wallet_ID LEFT JOIN \`USER\` us ON ws.User_ID=us.User_ID LEFT JOIN WALLET wr ON t.Receiver_Wallet_ID=wr.Wallet_ID LEFT JOIN \`USER\` ur ON wr.User_ID=ur.User_ID ${where} ORDER BY t.Txn_Time DESC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
        const txns = rows.map(r => ({
            txn_id: r.Txn_ID, amount: parseFloat(r.Amount),
            type: r.Sender_Wallet_ID === wid ? 'sent' : 'received',
            txn_type: r.Txn_Type, time: r.Txn_Time, status: r.Txn_Status,
            fraud_score: parseFloat(r.fraud_score || 0), is_flagged: !!r.is_flagged, description: r.description,
            counterparty: { name: r.Sender_Wallet_ID === wid ? r.Receiver_Name : r.Sender_Name, email: r.Sender_Wallet_ID === wid ? r.Receiver_Email : r.Sender_Email }
        }));
        res.json({ transactions: txns, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) { console.error('getTransactions error:', err); res.status(500).json({ error: 'Failed to fetch transactions' }); }
};
