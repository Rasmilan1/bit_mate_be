# 📡 BitMat - Study Material Manager (Backend API)

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=nodedotjs)
![Express](https://img.shields.io/badge/Express-4.19-000000?style=flat&logo=express)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat&logo=supabase)

The backend RESTful API server for **BitMat (Study Hub)**. Built using **Node.js** and **Express**, integrated with **Supabase Cloud** for PostgreSQL database persistence, authentication, and cloud PDF storage.

---

## ✨ Features

- 🔐 **Authentication API**: User signup, login, and token session verification via Supabase Auth.
- 📁 **PDF Upload & Storage**: Multipart handling via `multer` for uploading study PDFs directly to Supabase Cloud Storage.
- 🏛️ **Semesters & Subjects Management**: Endpoints for course curricula, subjects, and categorization.
- 📝 **Markdown Notes CRUD**: Save, update, and fetch per-document study notes.
- 📈 **Study Tracker Metrics**: Record study activity logs and compute user learning analytics.
- 🛡️ **Security**: Configured CORS policies and environment configuration.

---

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (ES Modules)
- **Framework**: [Express 4](https://expressjs.com/)
- **Database & File Storage**: [Supabase Cloud](https://supabase.com/)
- **File Upload Middleware**: [Multer](https://github.com/expressjs/multer)
- **Middleware**: `cors`, `dotenv`

---

## 📁 Folder Structure

```text
server/src/
├── index.js          # Express app entry point & server configuration
├── supabase.js       # Supabase Cloud Client instance setup
└── routes/
    ├── auth.js       # Authentication routes (login, register)
    ├── semesters.js  # Semester management endpoints
    ├── subjects.js   # Subject management endpoints
    ├── materials.js  # Material CRUD & PDF upload endpoints
    ├── notes.js      # Markdown notes CRUD endpoints
    └── tracker.js    # Study tracker activity endpoints
```

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root of the server directory:
```env
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_STORAGE_BUCKET=study-pdfs
```

### 3. Database Schema
Execute the database setup script in [`supabase_schema.sql`](./supabase_schema.sql) in your Supabase SQL Editor.

### 4. Run Server
```bash
# Start in production mode
npm start

# Start in development mode (with watch)
npm run dev
```
The server will run at [http://localhost:5000](http://localhost:5000).

---

## 🔗 Related Repositories

- **Frontend Client**: [bit_mate_fe](https://github.com/Rasmilan1/bit_mate_fe.git)
