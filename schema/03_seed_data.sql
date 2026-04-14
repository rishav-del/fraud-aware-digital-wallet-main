-- ============================================================
-- SEED DATA — matches your original relational model exactly
-- (with firebase_uid added, Password removed)
-- ============================================================
USE fraud_wallet;

-- USERS (Password removed, firebase_uid will be set on first login)
INSERT INTO `USER` (User_ID, Name, Email, Phone, Account_Status, Created_At) VALUES
('U001','Arjun Rao','arjun@mail.com','9876543210','Active','2024-01-01'),
('U002','Sneha Mehta','sneha@mail.com','9123456780','Active','2024-01-02'),
('U003','Rahul Verma','rahul@mail.com','9012345678','Suspended','2024-01-03'),
('U004','Priya Singh','priya@mail.com','9988776655','Active','2024-01-04'),
('U005','Amit Shah','amit@mail.com','9898989898','Active','2024-01-05'),
('U006','Neha Kapoor','neha@mail.com','9777665544','Active','2024-01-06'),
('U007','Karan Malhotra','karan@mail.com','9666554433','Blocked','2024-01-07'),
('U008','Isha Jain','isha@mail.com','9555443322','Active','2024-01-08'),
('U009','Vikram Nair','vikram@mail.com','9444332211','Active','2024-01-09'),
('U010','Anjali Das','anjali@mail.com','9333221100','Active','2024-01-10');

-- WALLETS (your exact data)
INSERT INTO WALLET (Wallet_ID, Balance, Wallet_Status, Created_Date, User_ID) VALUES
('W101',5000.00,'Active','2024-01-01','U001'),
('W102',3000.00,'Active','2024-01-02','U002'),
('W103',2000.00,'Frozen','2024-01-03','U003'),
('W104',4500.00,'Active','2024-01-04','U004'),
('W105',7000.00,'Active','2024-01-05','U005'),
('W106',1500.00,'Active','2024-01-06','U006'),
('W107',900.00,'Frozen','2024-01-07','U007'),
('W108',6000.00,'Active','2024-01-08','U008'),
('W109',8000.00,'Active','2024-01-09','U009'),
('W110',2500.00,'Active','2024-01-10','U010');

-- DEVICES (your exact data)
INSERT INTO DEVICE VALUES
('D01','Mobile','192.168.1.1','Delhi',TRUE,'2024-02-01','U001'),
('D02','Laptop','192.168.1.2','Mumbai',TRUE,'2024-02-02','U002'),
('D03','Tablet','192.168.1.3','Pune',FALSE,'2024-02-03','U003'),
('D04','Mobile','192.168.1.4','Chennai',TRUE,'2024-02-04','U004'),
('D05','Laptop','192.168.1.5','Kolkata',TRUE,'2024-02-05','U005'),
('D06','Mobile','192.168.1.6','Delhi',FALSE,'2024-02-06','U006'),
('D07','Tablet','192.168.1.7','Mumbai',TRUE,'2024-02-07','U007'),
('D08','Mobile','192.168.1.8','Pune',TRUE,'2024-02-08','U008'),
('D09','Laptop','192.168.1.9','Chennai',TRUE,'2024-02-09','U009'),
('D10','Mobile','192.168.1.10','Kolkata',TRUE,'2024-02-10','U010');

-- KYC (your exact data)
INSERT INTO KYC VALUES
('K01','PAN','PAN001','Verified','2024-01-01','2024-01-02','2030-01-01','U001'),
('K02','Aadhar','AAD002','Verified','2024-01-02','2024-01-03','2030-01-01','U002'),
('K03','PAN','PAN003','Pending','2024-01-03',NULL,'2030-01-01','U003'),
('K04','Passport','PAS004','Verified','2024-01-04','2024-01-05','2030-01-01','U004'),
('K05','PAN','PAN005','Verified','2024-01-05','2024-01-06','2030-01-01','U005'),
('K06','Aadhar','AAD006','Verified','2024-01-06','2024-01-07','2030-01-01','U006'),
('K07','PAN','PAN007','Rejected','2024-01-07',NULL,'2030-01-01','U007'),
('K08','Passport','PAS008','Verified','2024-01-08','2024-01-09','2030-01-01','U008'),
('K09','PAN','PAN009','Verified','2024-01-09','2024-01-10','2030-01-01','U009'),
('K10','Aadhar','AAD010','Verified','2024-01-10','2024-01-11','2030-01-01','U010');

-- TRANSACTIONS (your exact data + new columns with defaults)
INSERT INTO TRANSACTION (Txn_ID, Amount, Txn_Type, Txn_Time, Txn_Status, Sender_Wallet_ID, Receiver_Wallet_ID) VALUES
('T01',500.00,'Transfer','2024-02-01','Success','W101','W102'),
('T02',1200.00,'Transfer','2024-02-02','Success','W102','W103'),
('T03',700.00,'Transfer','2024-02-03','Failed','W104','W105'),
('T04',2000.00,'Transfer','2024-02-04','Success','W105','W106'),
('T05',450.00,'Transfer','2024-02-05','Success','W106','W107'),
('T06',3000.00,'Transfer','2024-02-06','Blocked','W108','W109'),
('T07',800.00,'Transfer','2024-02-07','Success','W109','W110'),
('T08',1500.00,'Transfer','2024-02-08','Success','W110','W101'),
('T09',600.00,'Transfer','2024-02-09','Success','W102','W104'),
('T10',5000.00,'Transfer','2024-02-10','Success','W105','W108');

-- FRAUD_ALERTS (your exact data)
INSERT INTO FRAUD_ALERT VALUES
('A01','HighAmount',85.00,'2024-02-01','Reviewed','T01'),
('A02','SuspiciousIP',75.00,'2024-02-02','Reviewed','T02'),
('A03','HighFrequency',90.00,'2024-02-03','Open','T03'),
('A04','HighAmount',80.00,'2024-02-04','Reviewed','T04'),
('A05','DeviceRisk',70.00,'2024-02-05','Closed','T05'),
('A06','HighAmount',95.00,'2024-02-06','Reviewed','T06'),
('A07','SuspiciousIP',65.00,'2024-02-07','Closed','T07'),
('A08','DeviceRisk',60.00,'2024-02-08','Closed','T08'),
('A09','HighAmount',88.00,'2024-02-09','Reviewed','T09'),
('A10','HighAmount',92.00,'2024-02-10','Open','T10');

-- ADMIN (your exact data)
INSERT INTO ADMIN VALUES
('AD01','Ravi','ravi@wallet.com','FraudOfficer'),
('AD02','Meera','meera@wallet.com','FraudOfficer'),
('AD03','Sohan','sohan@wallet.com','Auditor'),
('AD04','Kavya','kavya@wallet.com','FraudOfficer'),
('AD05','Rohan','rohan@wallet.com','Auditor'),
('AD06','Ankit','ankit@wallet.com','FraudOfficer'),
('AD07','Nidhi','nidhi@wallet.com','Auditor'),
('AD08','Varun','varun@wallet.com','FraudOfficer'),
('AD09','Simran','simran@wallet.com','Auditor'),
('AD10','Ajay','ajay@wallet.com','FraudOfficer');

-- REVIEW (your exact data)
INSERT INTO REVIEW VALUES
('A01','AD01','Approved','2024-02-01',NULL),
('A02','AD02','Approved','2024-02-02',NULL),
('A03','AD03','Pending','2024-02-03',NULL),
('A04','AD04','Approved','2024-02-04',NULL),
('A05','AD05','Closed','2024-02-05',NULL),
('A06','AD06','Approved','2024-02-06',NULL),
('A07','AD07','Closed','2024-02-07',NULL),
('A08','AD08','Closed','2024-02-08',NULL),
('A09','AD09','Approved','2024-02-09',NULL),
('A10','AD10','Pending','2024-02-10',NULL);
