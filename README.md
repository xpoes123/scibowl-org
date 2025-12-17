# 🧪 Scibowl Org  
### A Modern Science Bowl Practice & Competition Platform — React + TypeScript (MVP In Progress)

**Scibowl Org** is a full-stack platform designed for **National Science Bowl (NSB)** students, teams, coaches, and tournament organizers.

The mission:  
> **Build the most complete, modern, competitive, and community-driven Science Bowl platform online.**

Scibowl Org offers solo practice tools, multiplayer buzzing, question writing utilities, tournament organization features, coaching dashboards, and powerful analytics.  
The project is in **active MVP development**, starting with the front-end (React + TypeScript) and soon expanding to a Django backend.

---

## 🚀 Development Roadmap  
Scibowl Org is built in **five major phases**:

---

## **Phase 1 — Core Functions (In Progress)**
Build the foundational practice experience:

- Full question dataset (static for now)
- Search engine (text, answer type, category filters)
- UI: QuestionList, filters, PracticeCard with short-answer + MC
- Session stats (accuracy, history)
- Hotkeys for fast navigation (Enter/Skip/Next)
- Flashcard mode (MVP complete)

---

## **Phase 2 — Multiplayer**
Introduce competitive play:

- 1v1 buzzing matches (polling → WebSockets later)
- Question lockout + judging/override flow
- Match results + basic rating system
- Rooms and simple invites
- Adjustable match settings (categories, difficulty, modes)

---

## **Phase 3 — Tournament Organizer (TO) Tools**
Support real events and scrimmages:

- Packet upload (PDF/ZIP → parser)
- Automatic round builder
- Reader/Moderator UI
- Live scorekeeping tools
- Room assignment dashboard
- Results export + statistics

---

## **Phase 4 — Social & Community**
Make the platform engaging and persistent:

- User accounts and profiles
- Leaderboards (weekly/monthly/all-time)
- Achievements & streaks
- Commenting + discussions on questions
- Submission leaderboards
- Bookmarking and study lists

---

## **Phase 5 — Coaching & Team Tools**
Empower teams and coaches:

- Team creation + roles
- Coach dashboard with assignments
- Player analytics (category weakness, accuracy trends)
- Team scrimmage tools
- Saved sessions + review pages
- Heatmaps, buzzpoint patterns, growth tracking

---

## 🧰 Tech Stack

### **Frontend**
- React (Vite)
- TypeScript
- TailwindCSS
- Hotkey-driven UX
- Modular component design

### **Backend**
- Django + Django REST Framework
- PostgreSQL
- JWT Authentication
- Docker

---

## 📘 Current MVP Features

### **Question Database**
- Text search (question + answer)
- Category filters
- Question category types (MC, identify-all, rank)
- Randomizing engine with unseen-question tracking
- Previous question history sidebar

### **Practice Mode**
- Flashcard system
- Hotkeys for submit/next/skip
- Multiple-choice mode
- Identify-all & rank support
- Accuracy + stats
- Start/pause system

---

## ▶️ Getting Started

### **Monorepo Structure**
```
nsb-arena/
├── frontend/         # React + TypeScript + Vite
├── backend/          # Django + PostgreSQL API
├── docker-compose.yml
└── README.md
```

### **Quick Start with Docker (Recommended)**

```bash
# Start everything (frontend + backend + database)
docker-compose up

# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Admin Panel: http://localhost:8000/admin
```

### **Manual Setup**

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

**Backend:**
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set up database (requires PostgreSQL running)
python manage.py migrate
python manage.py createsuperuser

# Run server
python manage.py runserver
# Runs on http://localhost:8000
```

---

## 🔧 Development Commands

### **Docker Commands**
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up --build

# Run Django commands
docker-compose exec backend python manage.py <command>
```

### **Backend Commands**
```bash
# Create migrations
docker-compose exec backend python manage.py makemigrations

# Apply migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Access Django shell
docker-compose exec backend python manage.py shell
```

---

## 📡 API Endpoints

### **Authentication**
- `POST /api/auth/register/` - Register new user
- `POST /api/auth/login/` - Login (get JWT tokens)
- `POST /api/auth/refresh/` - Refresh access token
- `GET /api/profile/` - Get current user profile
- `PUT /api/profile/` - Update profile

### **Questions**
- `GET /api/questions/` - List questions (supports filtering by category, type, difficulty)
- `GET /api/questions/<id>/` - Get question details
- `POST /api/questions/history/` - Submit answer
- `GET /api/questions/history/` - Get answer history
- `POST /api/questions/bookmarks/` - Bookmark question
- `GET /api/questions/bookmarks/` - List bookmarks
