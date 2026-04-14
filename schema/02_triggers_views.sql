-- ============================================================
-- TRIGGERS, VIEWS, AND STORED PROCEDURES
-- ============================================================
USE fraud_wallet;

-- ============================================================
-- TRIGGER 1: Auto-flag transactions with high fraud score
-- DBMS Concept: AFTER INSERT trigger for automated fraud flagging
-- When ML model scores a transaction >= 70, auto-create a FRAUD_ALERT
-- ============================================================
DELIMITER //
CREATE TRIGGER trg_auto_fraud_flag
AFTER UPDATE ON TRANSACTION
FOR EACH ROW
BEGIN
    -- Only fire when fraud_score is updated and exceeds threshold
    IF NEW.fraud_score >= 70 AND NEW.is_flagged = TRUE
       AND (OLD.fraud_score < 70 OR OLD.is_flagged = FALSE) THEN

        INSERT INTO FRAUD_ALERT (Alert_ID, Alert_Type, Risk_Score, Alert_Time, Alert_Status, Txn_ID)
        VALUES (
            CONCAT('A', LPAD(FLOOR(RAND() * 99999), 5, '0')),
            CASE
                WHEN NEW.Amount >= 10000 THEN 'HighAmount'
                WHEN NEW.fraud_score >= 90 THEN 'BehavioralAnomaly'
                ELSE 'HighFrequency'
            END,
            NEW.fraud_score,
            NOW(),
            'Open',
            NEW.Txn_ID
        );
    END IF;
END //
DELIMITER ;

-- ============================================================
-- TRIGGER 2: Audit log for wallet balance changes
-- DBMS Concept: Maintains immutable audit trail for compliance
-- ============================================================
DELIMITER //
CREATE TRIGGER trg_wallet_audit
AFTER UPDATE ON WALLET
FOR EACH ROW
BEGIN
    IF OLD.Balance != NEW.Balance THEN
        INSERT INTO AUDIT_LOG (Table_Name, Record_ID, Action, Old_Value, New_Value, Changed_By)
        VALUES (
            'WALLET',
            NEW.Wallet_ID,
            'UPDATE',
            JSON_OBJECT('Balance', OLD.Balance, 'Status', OLD.Wallet_Status),
            JSON_OBJECT('Balance', NEW.Balance, 'Status', NEW.Wallet_Status),
            'SYSTEM'
        );
    END IF;
END //
DELIMITER ;

-- ============================================================
-- TRIGGER 3: Block transactions from frozen/suspended wallets
-- DBMS Concept: BEFORE INSERT constraint enforcement
-- ============================================================
DELIMITER //
CREATE TRIGGER trg_block_frozen_wallet
BEFORE INSERT ON TRANSACTION
FOR EACH ROW
BEGIN
    DECLARE sender_status VARCHAR(10);
    IF NEW.Sender_Wallet_ID IS NOT NULL THEN
        SELECT Wallet_Status INTO sender_status
        FROM WALLET WHERE Wallet_ID = NEW.Sender_Wallet_ID;
        IF sender_status = 'Frozen' THEN
            SET NEW.Txn_Status = 'Blocked';
        END IF;
    END IF;
END //
DELIMITER ;

-- ============================================================
-- VIEW 1: Fraud Summary Dashboard
-- DBMS Concept: Virtual table aggregating fraud data for reporting
-- ============================================================
CREATE OR REPLACE VIEW vw_fraud_summary AS
SELECT
    fa.Alert_ID,
    fa.Alert_Type,
    fa.Risk_Score,
    fa.Alert_Status,
    fa.Alert_Time,
    t.Txn_ID,
    t.Amount,
    t.Txn_Time,
    t.Txn_Status,
    u_sender.Name AS Sender_Name,
    u_sender.Email AS Sender_Email,
    u_recv.Name AS Receiver_Name
FROM FRAUD_ALERT fa
JOIN TRANSACTION t ON fa.Txn_ID = t.Txn_ID
LEFT JOIN WALLET ws ON t.Sender_Wallet_ID = ws.Wallet_ID
LEFT JOIN `USER` u_sender ON ws.User_ID = u_sender.User_ID
LEFT JOIN WALLET wr ON t.Receiver_Wallet_ID = wr.Wallet_ID
LEFT JOIN `USER` u_recv ON wr.User_ID = u_recv.User_ID
ORDER BY fa.Alert_Time DESC;

-- ============================================================
-- VIEW 2: User wallet overview (used by dashboard API)
-- ============================================================
CREATE OR REPLACE VIEW vw_user_wallet AS
SELECT
    u.User_ID,
    u.Name,
    u.Email,
    u.firebase_uid,
    u.Account_Status,
    w.Wallet_ID,
    w.Balance,
    w.Wallet_Status
FROM `USER` u
JOIN WALLET w ON u.User_ID = w.User_ID;

-- ============================================================
-- VIEW 3: Transaction history with user names
-- ============================================================
CREATE OR REPLACE VIEW vw_transaction_history AS
SELECT
    t.Txn_ID,
    t.Amount,
    t.Txn_Type,
    t.Txn_Time,
    t.Txn_Status,
    t.fraud_score,
    t.is_flagged,
    t.description,
    t.Sender_Wallet_ID,
    t.Receiver_Wallet_ID,
    us.Name AS Sender_Name,
    us.Email AS Sender_Email,
    ur.Name AS Receiver_Name,
    ur.Email AS Receiver_Email
FROM TRANSACTION t
LEFT JOIN WALLET ws ON t.Sender_Wallet_ID = ws.Wallet_ID
LEFT JOIN `USER` us ON ws.User_ID = us.User_ID
LEFT JOIN WALLET wr ON t.Receiver_Wallet_ID = wr.Wallet_ID
LEFT JOIN `USER` ur ON wr.User_ID = ur.User_ID
ORDER BY t.Txn_Time DESC;

-- ============================================================
-- STORED PROCEDURE: Send Money (with TRANSACTION/COMMIT/ROLLBACK)
-- DBMS Concept: ACID-compliant fund transfer
-- Uses: START TRANSACTION, COMMIT, ROLLBACK, SELECT...FOR UPDATE
-- ============================================================
DELIMITER //
CREATE PROCEDURE sp_send_money(
    IN p_txn_id VARCHAR(20),
    IN p_sender_wallet VARCHAR(10),
    IN p_receiver_wallet VARCHAR(10),
    IN p_amount DECIMAL(15,2),
    IN p_description TEXT,
    IN p_fraud_score DECIMAL(5,2),
    IN p_is_flagged BOOLEAN,
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_sender_balance DECIMAL(15,2);
    DECLARE v_sender_status VARCHAR(10);
    DECLARE v_receiver_status VARCHAR(10);

    -- Error handler: any SQL error triggers ROLLBACK
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'Failed';
        SET p_message = 'Database error — transaction rolled back';
    END;

    START TRANSACTION;

    -- Lock sender wallet row to prevent race conditions (pessimistic locking)
    SELECT Balance, Wallet_Status INTO v_sender_balance, v_sender_status
    FROM WALLET WHERE Wallet_ID = p_sender_wallet FOR UPDATE;

    -- Lock receiver wallet
    SELECT Wallet_Status INTO v_receiver_status
    FROM WALLET WHERE Wallet_ID = p_receiver_wallet FOR UPDATE;

    -- Validation checks
    IF v_sender_status = 'Frozen' THEN
        ROLLBACK;
        SET p_status = 'Blocked';
        SET p_message = 'Sender wallet is frozen';
    ELSEIF v_receiver_status = 'Frozen' THEN
        ROLLBACK;
        SET p_status = 'Blocked';
        SET p_message = 'Receiver wallet is frozen';
    ELSEIF v_sender_balance < p_amount THEN
        ROLLBACK;
        SET p_status = 'Failed';
        SET p_message = 'Insufficient balance';
    ELSEIF p_is_flagged = TRUE AND p_fraud_score >= 90 THEN
        -- High-risk: insert txn as Blocked, don't move money
        INSERT INTO TRANSACTION (Txn_ID, Amount, Txn_Type, Txn_Status,
            Sender_Wallet_ID, Receiver_Wallet_ID, description, fraud_score, is_flagged)
        VALUES (p_txn_id, p_amount, 'Transfer', 'Blocked',
            p_sender_wallet, p_receiver_wallet, p_description, p_fraud_score, TRUE);
        COMMIT;
        SET p_status = 'Blocked';
        SET p_message = 'Transaction blocked — fraud risk too high';
    ELSE
        -- Debit sender
        UPDATE WALLET SET Balance = Balance - p_amount
        WHERE Wallet_ID = p_sender_wallet;

        -- Credit receiver
        UPDATE WALLET SET Balance = Balance + p_amount
        WHERE Wallet_ID = p_receiver_wallet;

        -- Record transaction
        INSERT INTO TRANSACTION (Txn_ID, Amount, Txn_Type, Txn_Status,
            Sender_Wallet_ID, Receiver_Wallet_ID, description, fraud_score, is_flagged)
        VALUES (p_txn_id, p_amount, 'Transfer',
            IF(p_is_flagged, 'Pending', 'Success'),
            p_sender_wallet, p_receiver_wallet, p_description, p_fraud_score, p_is_flagged);

        COMMIT;
        SET p_status = IF(p_is_flagged, 'Pending', 'Success');
        SET p_message = IF(p_is_flagged,
            'Transaction under review — flagged by fraud system',
            'Transaction successful');
    END IF;
END //
DELIMITER ;

-- ============================================================
-- STORED PROCEDURE: Add Money (simulated top-up)
-- ============================================================
DELIMITER //
CREATE PROCEDURE sp_add_money(
    IN p_wallet_id VARCHAR(10),
    IN p_amount DECIMAL(15,2),
    OUT p_status VARCHAR(20),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_wallet_status VARCHAR(10);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'Failed';
        SET p_message = 'Database error — transaction rolled back';
    END;

    START TRANSACTION;

    SELECT Wallet_Status INTO v_wallet_status
    FROM WALLET WHERE Wallet_ID = p_wallet_id FOR UPDATE;

    IF v_wallet_status = 'Frozen' THEN
        ROLLBACK;
        SET p_status = 'Blocked';
        SET p_message = 'Wallet is frozen';
    ELSE
        UPDATE WALLET SET Balance = Balance + p_amount
        WHERE Wallet_ID = p_wallet_id;

        INSERT INTO TRANSACTION (Txn_ID, Amount, Txn_Type, Txn_Status,
            Receiver_Wallet_ID, fraud_score, is_flagged)
        VALUES (
            CONCAT('TXN', DATE_FORMAT(NOW(),'%Y%m%d%H%i%s'), LPAD(FLOOR(RAND()*999),3,'0')),
            p_amount, 'AddMoney', 'Success', p_wallet_id, 0, FALSE
        );

        COMMIT;
        SET p_status = 'Success';
        SET p_message = CONCAT('₹', p_amount, ' added to wallet');
    END IF;
END //
DELIMITER ;
