# ScrapConnect Backend (`scrapconnect-backend`)

> **ScrapConnect** is a location-based platform connecting scrap sellers (households, businesses) with scrap buyers/collectors.

This repository handles the core RESTful APIs, database operations, business logic, authentication, and communication protocols for the ScrapConnect platform.

---

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (v16+)
- **Framework**: [Express.js](https://expressjs.com/) (v5)
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
│   │   └── env.js             # Environment variable configuration
│   ├── controllers/
│   │   └── health.controller.js  # Controller logic for system health checks
│   ├── middleware/
│   │   └── error.middleware.js   # 404 & Centralized error handling
│   ├── models/                # Database models (to be added)
│   ├── routes/
│   │   ├── health.routes.js   # Health check route definitions
│   │   └── index.js           # API route router aggregator
│   ├── services/              # Business logic services (to be added)
│   ├── app.js                 # Express application setup
│   └── server.js              # Server entry point & listener
├── .env                       # Environment variables (git-ignored)
├── .env.example               # Environment variables template
├── .gitignore                 # Files excluded from version control
├── package.json               # Node.js dependencies and scripts
└── README.md                  # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v16 or higher) and `npm` installed on your machine.

```bash
node -v
npm -v
```

---

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/muzammilpk/scrapconnect-backend.git
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

Default server port is **`5000`**. The server will be accessible at `http://localhost:5000`.

---

## 📡 API Endpoints

### Health Check

- **Endpoint**: `GET /api/health`
- **Access**: Public
- **Description**: Verifies that the backend server is online and operational.

#### Example Request

```bash
curl http://localhost:5000/api/health
```

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "message": "ScrapConnect backend is running"
}
```

---

## 🔗 GitHub Repository

- **Backend Repository**: [https://github.com/muzammilpk/scrapconnect-backend](https://github.com/muzammilpk/scrapconnect-backend)
- **Frontend Repository**: [https://github.com/muzammilpk/scrapconnect-frontend](https://github.com/muzammilpk/scrapconnect-frontend)
