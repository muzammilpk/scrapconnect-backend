# ScrapConnect Backend (`scrapconnect-backend`)

> **ScrapConnect** is a location-based platform connecting scrap sellers (households, businesses) with scrap buyers/collectors.

This repository handles the core RESTful APIs, database operations, business logic, authentication, and communication protocols for the ScrapConnect platform.

---

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (v16+)
- **Framework**: [Express.js](https://expressjs.com/) (v5)
- **Database**: [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/)
- **Language**: JavaScript (ES6+)
- **Environment Management**: `dotenv`
- **CORS Management**: `cors`
- **Development Tool**: `nodemon`

---

## 📁 Repository Structure

```text
scrapconnect-backend/
├── src/
│   ├── config/
│   │   ├── db.js              # MongoDB Mongoose connection setup
│   │   └── env.js             # Environment variable configuration
│   ├── controllers/
│   │   └── health.controller.js  # Controller logic for health checks
│   ├── middleware/
│   │   └── error.middleware.js   # 404 & Centralized error handling
│   ├── models/                # Database models (to be added in later steps)
│   ├── routes/
│   │   ├── health.routes.js   # Health check route definitions
│   │   └── index.js           # API route router aggregator
│   ├── services/              # Business logic services (to be added in later steps)
│   ├── app.js                 # Express application setup
│   └── server.js              # Server entry point & DB initialization
├── .env                       # Environment variables (git-ignored)
├── .env.example               # Environment variables template
├── .gitignore                 # Files excluded from version control
├── package.json               # Node.js dependencies and scripts
└── README.md                  # Project documentation
```

---

## 🍃 MongoDB & Database Setup

### Local MongoDB Setup
If running MongoDB locally, start the local MongoDB service on `localhost:27017`:
```env
MONGO_URI=mongodb://127.0.0.1:27017/scrapconnect
```

### MongoDB Atlas Setup (Cloud Database)
1. Sign up or log into [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new Cluster (Free M0 Shared Cluster).
3. Under **Database Access**, create a database user with a username and password.
4. Under **Network Access**, add IP address `0.0.0.0/0` (or your current IP) to the IP access list.
5. Click **Connect** on your cluster, select **Drivers (Node.js)**, and copy the connection string.
6. Replace `<username>` and `<password>` in the connection string and paste it into your local `.env` file as `MONGO_URI`:
   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/scrapconnect?retryWrites=true&w=majority
   ```

> [!WARNING]
> Do NOT commit your actual `.env` file or MongoDB connection credentials to Git.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v16 or higher) and `npm` installed:

```bash
node -v
npm -v
```

---

### Installation

1. Navigate to the backend directory:
   ```bash
   cd scrapconnect-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory (or copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Set `PORT` and your `MONGO_URI` in `.env`.

---

## 🏃 Running the Server

### Development Mode (with hot-reloading)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

Default server port is **`5000`**. The server will connect to MongoDB first, then start listening at `http://localhost:5000`.

---

## 📡 Verification & Health Check

### Health Check Endpoint

- **Endpoint**: `GET /api/health`
- **Access**: Public
- **Description**: Verifies that the backend server is online and checks MongoDB connection status.

#### Example Request

```bash
curl http://localhost:5000/api/health
```

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "message": "ScrapConnect backend is running",
  "database": {
    "status": "connected",
    "connected": true
  },
  "timestamp": "2026-08-30T23:41:00.000Z"
}
```

---

## 🔗 GitHub Repositories

- **Backend Repository**: [https://github.com/muzammilpk/scrapconnect-backend](https://github.com/muzammilpk/scrapconnect-backend)
- **Frontend Repository**: [https://github.com/muzammilpk/scrapconnect-frontend](https://github.com/muzammilpk/scrapconnect-frontend)
