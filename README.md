# FraudAware Digital Wallet System

Full-stack fintech prototype: MySQL + Node.js/Express + Firebase Auth + ML fraud detection.

## Project Structure

```
fraud-wallet/
├── frontend/
│   ├── index.html              ← Clean HTML (structure only)
│   ├── css/
│   │   ├── styles.css          ← Variables, reset, layout, nav, sidebar
│   │   ├── components.css      ← Cards, buttons, forms, chips, tables, toasts
│   │   └── pages.css           ← Dashboard, send, transactions, fraud, profile, login
│   └── js/
│       ├── config.js           ← API URL, Firebase config, constants
│       ├── api.js              ← HTTP client, Firebase auth, demo mode
│       ├── pages.js            ← All page data-loading logic
│       └── app.js              ← Navigation, toast, modal, init
├── backend/
│   ├── server.js
│   ├── config/ (db.js, firebase.js)
│   ├── middleware/ (auth.js)
│   ├── controllers/ (wallet, transaction, fraud)
│   └── routes/ (api.js)
├── ml/
│   ├── train_model.py
│   ├── fraud_api.py
│   └── requirements.txt
└── schema/
    ├── 01_schema.sql
    ├── 02_triggers_views.sql
    └── 03_seed_data.sql
```

## macOS Setup (Step-by-Step)

### Prerequisites

```bash
brew install mysql node python3
brew services start mysql
mysql_secure_installation
```

### Step 1: Database

```bash
cd fraud-wallet
mysql -u root -p < schema/01_schema.sql
mysql -u root -p < schema/02_triggers_views.sql
mysql -u root -p < schema/03_seed_data.sql
```

### Step 2: ML Model (Terminal tab 1)

```bash
cd fraud-wallet/ml
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python train_model.py
python fraud_api.py    # keep running on :5001
```

### Step 3: Backend (Terminal tab 2)

```bash
cd fraud-wallet/backend
npm install
cp .env.example .env   # edit DB_PASSWORD
node server.js         # keep running on :3000
```

### Step 4: Open Browser

```bash
open http://localhost:3000
```

Click "Demo Login" — done!

## Demo curl Commands

```bash
# Normal transaction
curl -X POST http://localhost:3000/api/send-money \
  -H "Content-Type: application/json" \
  -H "X-Demo-User-Email: arjun@mail.com" \
  -d '{"recipient_email":"sneha@mail.com","amount":500,"note":"Lunch"}'

# Suspicious high-value
curl -X POST http://localhost:3000/api/send-money \
  -H "Content-Type: application/json" \
  -H "X-Demo-User-Email: amit@mail.com" \
  -d '{"recipient_email":"neha@mail.com","amount":50000}'

# Rapid burst
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:3000/api/send-money \
    -H "Content-Type: application/json" \
    -H "X-Demo-User-Email: arjun@mail.com" \
    -d '{"recipient_email":"priya@mail.com","amount":200}' &
done; wait

# Add money
curl -X POST http://localhost:3000/api/add-money \
  -H "Content-Type: application/json" \
  -H "X-Demo-User-Email: arjun@mail.com" \
  -d '{"amount":5000}'

# Fraud check only
curl -X POST http://localhost:3000/api/fraud-check \
  -H "Content-Type: application/json" \
  -H "X-Demo-User-Email: arjun@mail.com" \
  -d '{"amount":75000}'
```
