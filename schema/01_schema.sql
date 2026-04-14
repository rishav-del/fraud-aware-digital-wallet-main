-- ============================================================
-- FRAUD-AWARE DIGITAL WALLET SYSTEM — MySQL Schema
-- ============================================================
-- BASE: Your original relational model (USER, WALLET, DEVICE,
--       KYC, TRANSACTION, FRAUD_ALERT, ADMIN, REVIEW)
--
-- CHANGES LOG (every modification explained):
-- ============================================================
--
-- 1. USER table:
--    - ADDED `firebase_uid` VARCHAR(128) — needed to link Firebase Auth
--      to our MySQL user record. Without this, we can't map JWT tokens
--      to database users.
--    - REMOVED `Password` column — Firebase handles authentication;
--      storing passwords in MySQL creates a security liability and
--      violates separation of concerns. Your original had plaintext
--      passwords (pass1, pass2...) which is a critical vulnerability.
--    - ADDED UNIQUE constraint on Email — 2NF requires no partial
--      dependencies; email is a candidate key and must be unique.
--    - ADDED INDEX on firebase_uid — frequently queried for auth lookups.
--
-- 2. WALLET table:
--    - CHANGED Balance from implicit type to DECIMAL(15,2) — floating
--      point causes rounding errors in financial systems. DECIMAL
--      ensures exact arithmetic (DBMS best practice for money).
--    - ADDED UNIQUE constraint on User_ID — 1:1 relationship enforced
--      at DB level (one wallet per user, matching your relational model).
--
-- 3. TRANSACTION table:
--    - ADDED `fraud_score` DECIMAL(5,2) — stores ML model output so
--      we don't need to re-run inference. Needed for /fraud-check API.
--    - ADDED `is_flagged` BOOLEAN DEFAULT FALSE — quick lookup flag
--      without joining FRAUD_ALERT table. Improves query performance.
--    - ADDED `description` TEXT — maps to "Note" field in your frontend
--      Send Money form.
--    - ADDED `device_id` — links transaction to device for fraud
--      feature extraction (behavioral anomaly detection).
--    - ADDED INDEX on Sender/Receiver wallet IDs — these are FK
--      lookups that happen on every transaction query. Without index,
--      MySQL does full table scan.
--    - ADDED INDEX on Txn_Time — your frontend filters by "This Month"
--      which needs efficient date range queries.
--
-- 4. FRAUD_ALERT table:
--    - No structural changes. Your design is solid.
--    - ADDED INDEX on Txn_ID for JOIN performance.
--
-- 5. NEW TABLE: `AUDIT_LOG`
--    - WHY: Your requirements specify logging/audit tables. This
--      tracks all state changes (balance updates, status changes,
--      fraud decisions) for compliance and debugging. Essential in
--      fintech systems for non-repudiation.
--
-- 6. NEW TABLE: `TRANSACTION_FEATURES`
--    - WHY: ML model needs computed features (frequency, avg amount,
--      time patterns). Storing them avoids recomputation and creates
--      an audit trail of what the model "saw" when it scored a txn.
--
-- 7. REVIEW table:
--    - ADDED composite PRIMARY KEY (Alert_ID, Admin_ID) — your
--      original had no explicit PK. This composite key prevents
--      duplicate reviews and satisfies 1NF (unique row identification).
--
-- ============================================================

CREATE DATABASE IF NOT EXISTS fraud_wallet;
USE fraud_wallet;

-- ============================================================
-- TABLE: USER
-- Original columns preserved: User_ID, Name, Email, Phone,
--   Account_Status, Created_At
-- Removed: Password (Firebase handles auth)
-- Added: firebase_uid
-- ============================================================
CREATE TABLE `USER` (
    User_ID         VARCHAR(10)     PRIMARY KEY,
    firebase_uid    VARCHAR(128)    UNIQUE,              -- ADDED: Firebase Auth link
    Name            VARCHAR(100)    NOT NULL,
    Email           VARCHAR(100)    NOT NULL UNIQUE,     -- ADDED: UNIQUE constraint
    Phone           VARCHAR(15),
    Account_Status  ENUM('Active','Suspended','Blocked') DEFAULT 'Active',
    Created_At      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_firebase_uid (firebase_uid)                -- ADDED: fast auth lookups
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: WALLET
-- Original columns preserved: Wallet_ID, Balance, Wallet_Status,
--   Created_Date, User_ID
-- Changed: Balance type to DECIMAL(15,2)
-- Added: UNIQUE on User_ID
-- ============================================================
CREATE TABLE WALLET (
    Wallet_ID       VARCHAR(10)     PRIMARY KEY,
    Balance         DECIMAL(15,2)   NOT NULL DEFAULT 0.00,  -- CHANGED: exact arithmetic
    Wallet_Status   ENUM('Active','Frozen')  DEFAULT 'Active',
    Created_Date    DATETIME        DEFAULT CURRENT_TIMESTAMP,
    User_ID         VARCHAR(10)     NOT NULL UNIQUE,         -- ADDED: UNIQUE (1:1)

    CONSTRAINT fk_wallet_user FOREIGN KEY (User_ID)
        REFERENCES `USER`(User_ID) ON DELETE CASCADE,
    CONSTRAINT chk_balance CHECK (Balance >= 0)              -- ADDED: no negative balance
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: DEVICE
-- No changes. Your schema is already in 3NF.
-- ============================================================
CREATE TABLE DEVICE (
    Device_ID       VARCHAR(10)     PRIMARY KEY,
    Device_Type     ENUM('Mobile','Laptop','Tablet') NOT NULL,
    IP_Address      VARCHAR(45)     NOT NULL,
    Location        VARCHAR(100),
    Is_Trusted      BOOLEAN         DEFAULT FALSE,
    Last_Login      DATETIME,
    User_ID         VARCHAR(10)     NOT NULL,

    CONSTRAINT fk_device_user FOREIGN KEY (User_ID)
        REFERENCES `USER`(User_ID) ON DELETE CASCADE,
    INDEX idx_device_user (User_ID)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: KYC
-- No changes. Already normalized with proper FK.
-- ============================================================
CREATE TABLE KYC (
    KYC_ID              VARCHAR(10)     PRIMARY KEY,
    Document_Type       ENUM('PAN','Aadhar','Passport') NOT NULL,
    Document_Number     VARCHAR(50)     NOT NULL,
    Verification_Status ENUM('Verified','Pending','Rejected') DEFAULT 'Pending',
    Submitted_Date      DATE,
    Verified_Date       DATE            NULL,
    Expiry_Date         DATE,
    User_ID             VARCHAR(10)     NOT NULL,

    CONSTRAINT fk_kyc_user FOREIGN KEY (User_ID)
        REFERENCES `USER`(User_ID) ON DELETE CASCADE,
    INDEX idx_kyc_user (User_ID)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: TRANSACTION
-- Original columns preserved: Txn_ID, Amount, Txn_Type, Txn_Time,
--   Txn_Status, Sender_Wallet_ID, Receiver_Wallet_ID
-- Added: fraud_score, is_flagged, description, device_id
-- Added: Indexes on wallet FKs and time
-- ============================================================
CREATE TABLE TRANSACTION (
    Txn_ID              VARCHAR(20)     PRIMARY KEY,
    Amount              DECIMAL(15,2)   NOT NULL,
    Txn_Type            ENUM('Transfer','AddMoney') DEFAULT 'Transfer',
    Txn_Time            DATETIME        DEFAULT CURRENT_TIMESTAMP,
    Txn_Status          ENUM('Success','Failed','Blocked','Pending') DEFAULT 'Pending',
    Sender_Wallet_ID    VARCHAR(10),
    Receiver_Wallet_ID  VARCHAR(10),
    description         TEXT            NULL,                -- ADDED: maps to frontend "Note"
    fraud_score         DECIMAL(5,2)    DEFAULT 0.00,        -- ADDED: ML model output (0-100)
    is_flagged          BOOLEAN         DEFAULT FALSE,       -- ADDED: quick fraud lookup
    device_id           VARCHAR(10)     NULL,                -- ADDED: device tracking for ML

    CONSTRAINT fk_txn_sender FOREIGN KEY (Sender_Wallet_ID)
        REFERENCES WALLET(Wallet_ID),
    CONSTRAINT fk_txn_receiver FOREIGN KEY (Receiver_Wallet_ID)
        REFERENCES WALLET(Wallet_ID),
    CONSTRAINT fk_txn_device FOREIGN KEY (device_id)
        REFERENCES DEVICE(Device_ID),
    CONSTRAINT chk_amount CHECK (Amount > 0),

    INDEX idx_txn_sender (Sender_Wallet_ID),               -- ADDED: JOIN performance
    INDEX idx_txn_receiver (Receiver_Wallet_ID),            -- ADDED: JOIN performance
    INDEX idx_txn_time (Txn_Time),                          -- ADDED: date range queries
    INDEX idx_txn_flagged (is_flagged)                      -- ADDED: fraud filter queries
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: FRAUD_ALERT
-- No structural changes. Added index on Txn_ID.
-- ============================================================
CREATE TABLE FRAUD_ALERT (
    Alert_ID        VARCHAR(10)     PRIMARY KEY,
    Alert_Type      ENUM('HighAmount','SuspiciousIP','HighFrequency','DeviceRisk','BehavioralAnomaly') NOT NULL,
    Risk_Score      DECIMAL(5,2)    NOT NULL,
    Alert_Time      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    Alert_Status    ENUM('Open','Reviewed','Closed') DEFAULT 'Open',
    Txn_ID          VARCHAR(20)     NOT NULL,

    CONSTRAINT fk_alert_txn FOREIGN KEY (Txn_ID)
        REFERENCES TRANSACTION(Txn_ID),
    INDEX idx_alert_txn (Txn_ID)                            -- ADDED: JOIN performance
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: ADMIN
-- No changes.
-- ============================================================
CREATE TABLE ADMIN (
    Admin_ID    VARCHAR(10)     PRIMARY KEY,
    Name        VARCHAR(100)    NOT NULL,
    Email       VARCHAR(100)    NOT NULL UNIQUE,
    Role        ENUM('FraudOfficer','Auditor') NOT NULL
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: REVIEW
-- Added: composite PK (was missing), Review_Notes column
-- ============================================================
CREATE TABLE REVIEW (
    Alert_ID    VARCHAR(10)     NOT NULL,
    Admin_ID    VARCHAR(10)     NOT NULL,
    Decision    ENUM('Approved','Pending','Closed','Rejected') DEFAULT 'Pending',
    Review_Time DATETIME        DEFAULT CURRENT_TIMESTAMP,
    Review_Notes TEXT           NULL,                         -- ADDED: auditor can add notes

    PRIMARY KEY (Alert_ID, Admin_ID),                        -- ADDED: composite PK
    CONSTRAINT fk_review_alert FOREIGN KEY (Alert_ID)
        REFERENCES FRAUD_ALERT(Alert_ID),
    CONSTRAINT fk_review_admin FOREIGN KEY (Admin_ID)
        REFERENCES ADMIN(Admin_ID)
) ENGINE=InnoDB;

-- ============================================================
-- NEW TABLE: AUDIT_LOG
-- WHY: Fintech compliance requires immutable record of all
-- state-changing operations. Supports debugging and forensics.
-- ============================================================
CREATE TABLE AUDIT_LOG (
    Log_ID          INT             AUTO_INCREMENT PRIMARY KEY,
    Table_Name      VARCHAR(50)     NOT NULL,
    Record_ID       VARCHAR(20)     NOT NULL,
    Action          ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    Old_Value       JSON            NULL,
    New_Value       JSON            NULL,
    Changed_By      VARCHAR(128)    NULL,       -- firebase_uid or 'SYSTEM'
    Changed_At      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_audit_table (Table_Name, Record_ID),
    INDEX idx_audit_time (Changed_At)
) ENGINE=InnoDB;

-- ============================================================
-- NEW TABLE: TRANSACTION_FEATURES
-- WHY: Stores computed ML features per transaction. Creates an
-- audit trail of model inputs and avoids recomputation.
-- ============================================================
CREATE TABLE TRANSACTION_FEATURES (
    Txn_ID                  VARCHAR(20)     PRIMARY KEY,
    sender_txn_count_1h     INT             DEFAULT 0,    -- transactions in last hour
    sender_txn_count_24h    INT             DEFAULT 0,    -- transactions in last 24h
    sender_avg_amount       DECIMAL(15,2)   DEFAULT 0,    -- historical average
    amount_deviation        DECIMAL(10,2)   DEFAULT 0,    -- std devs from mean
    is_new_receiver         BOOLEAN         DEFAULT TRUE,  -- first time sending to this wallet
    hour_of_day             TINYINT,                       -- 0-23
    is_night_transaction    BOOLEAN         DEFAULT FALSE, -- 11PM - 5AM
    device_is_trusted       BOOLEAN         DEFAULT TRUE,
    sender_account_age_days INT             DEFAULT 0,

    CONSTRAINT fk_features_txn FOREIGN KEY (Txn_ID)
        REFERENCES TRANSACTION(Txn_ID)
) ENGINE=InnoDB;
