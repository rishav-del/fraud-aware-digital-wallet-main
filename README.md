# README.md

# Project Title
**Fraud-Aware Digital Wallet System**

---

## Project Objective

The Fraud-Aware Digital Wallet System is a web-based application designed to provide secure digital transactions with fraud detection capabilities.

**Key Objectives:**
- Enable users to manage digital wallet and transactions
- Detect fraudulent transactions using backend logic and ML module
- Provide real-time transaction monitoring
- Maintain secure user data and transaction history
- Reduce risks in digital payments through validation mechanisms

This project demonstrates full-stack development using Node.js, React, MySQL, and Python.

---

---
## Repository Folder Structure

| Sr. | Description | Link |
|-----|------------|------|
| 1 | **Project Code** | `backend / frontend / ml` |
| 2 | **Project Report** | [View Report](./Project_Report.pdf) |
| 3 | **Project PPT** | [View PPT](./Project_Presentation.pdf) |
```

### Detailed Folder Structure (Project Code):

```
fraud-aware-digital-wallet-main/
├── backend/        # Node.js backend APIs
├── frontend/       # React frontend
├── ml/             # Python ML fraud detection
├── schema/         # Database SQL files
├── README.md
```

```

## Steps to Run the Project

### Prerequisites
- Node.js installed
- XAMPP (MySQL)
- Python installed
- Postman (for API testing)

```

### Step-by-Step Installation

1. **Download the Project**
   - Download ZIP and extract

```

2. **Setup Database**
   - Open XAMPP and start Apache + MySQL
   - Open phpMyAdmin: http://localhost/phpmyadmin
   - Create database: `fraud_wallet`
   - Import files from `schema` folder:
     - 01_schema.sql
     - 02_triggers_views.sql
     - 03_seed_data.sql

```

3. **Configure Backend**
   - Go to backend folder
   - Create `.env` file:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=fraud_wallet
PORT=3000
```

```
4. **Run Backend**
```
cd backend
npm install
npm start
```

```

5. **Run Application**

Open in browser:
http://localhost:3000

```

6. **Test API (Postman)**

POST request:
http://localhost:3000/api/check-email

Body:

{
"email": "arjun@mail.com"
}

```

## Features Implemented

- Digital wallet system
- Transaction management
- Fraud detection logic
- API-based architecture
- MySQL database integration
- Postman API testing

```

## Technologies Used

- Frontend: React, HTML, CSS
- Backend: Node.js, Express
- Database: MySQL
- ML: Python (Flask)
- Tools: XAMPP, Postman

```

