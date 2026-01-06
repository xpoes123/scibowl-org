# 🧪 Scibowl Org (NSB Arena)
### A Modern Science Bowl Practice & Competition Platform — React + TypeScript + Django

**Scibowl Org** is a full-stack platform designed for **National Science Bowl (NSB)** students, teams, coaches, and tournament organizers.

The mission:
> **Build the most complete, modern, competitive, and community-driven Science Bowl platform online.**

Scibowl Org offers solo practice tools, tournament organization features, live scorekeeping, and powerful analytics. With planned features for multiplayer buzzing, coaching dashboards, and social leaderboards, the platform aims to replace Google Sheets for tournament management while providing students with modern practice tools.

The project is in **active MVP development** with a React + TypeScript frontend and Django REST backend fully integrated.

---

## 🚀 Development Roadmap  
Scibowl Org is built in **five major phases**:

---

## **Phase 1 — Core Functions (✅ Complete)**
Build the foundational practice experience:

- ✅ Full question database with comprehensive filtering
- ✅ Search engine (text, category, type, style, source filters)
- ✅ Multiple question types: Short Answer, Multiple Choice, Identify All, Rank
- ✅ Practice modes: Flashcard system with reveal mechanics, Reading mode
- ✅ Session stats (accuracy, history tracking via backend)
- ✅ Hotkey-driven UX (Enter/Skip/Next)
- ✅ User authentication and profiles
- ✅ Question bookmarking and answer history

---

## **Phase 2 — Multiplayer**
Introduce competitive play:

- 1v1 buzzing matches (polling → WebSockets later)
- Question lockout + judging/override flow
- Match results + basic rating system
- Rooms and simple invites
- Adjustable match settings (categories, difficulty, modes)

---

## **Phase 3 — Tournament Organizer (TO) Tools (🔨 In Progress)**
Support real events and scrimmages:

- ✅ Tournament creation and management (name, division, format, dates, location)
- ✅ Team and player management
- ✅ Room assignment system
- ✅ Round scheduling with packet assignments
- ✅ Live tournament dashboard with room status
- ✅ MODAQ integration (read-only API for game result ingestion)
- ✅ Player stats tracking (points, buzzes, accuracy)
- ✅ Game state tracking (current tossup, team scores)
- 🔨 PDF packet upload and parsing
- 🔨 Reader/Moderator UI for live games
- 🔨 Results export and detailed statistics
- 🔨 Pool play and bracket generation

---

## **Phase 4 — Social & Community (📋 Planned)**
Make the platform engaging and persistent:

- ✅ User accounts and profiles (basic implementation)
- 📋 Leaderboards (weekly/monthly/all-time)
- 📋 Achievements & streaks
- 📋 Commenting + discussions on questions
- 📋 Submission leaderboards
- 📋 Enhanced study lists and bookmarking features

---

## **Phase 5 — Coaching & Team Tools (📋 Planned)**
Empower teams and coaches:

- 📋 Team creation + roles
- 📋 Coach dashboard with assignments
- 📋 Player analytics (category weakness, accuracy trends)
- 📋 Team scrimmage tools
- 📋 Saved sessions + review pages
- 📋 Heatmaps, buzzpoint patterns, growth tracking

---

## 🧰 Tech Stack

### **Frontend**
- React 19.2 (Vite 7.2)
- TypeScript 5.9
- TailwindCSS 3.4
- React Router 7.9
- Hotkey-driven UX
- Feature-based architecture

### **Backend**
- Django 5.1.4 + Django REST Framework 3.15
- PostgreSQL 16
- JWT Authentication (djangorestframework-simplejwt)
- PDF Processing (pdfplumber)
- CORS enabled for cross-origin requests

### **DevOps**
- Docker & Docker Compose
- Multi-container orchestration (frontend, backend, database)
- Environment-based configuration

---

## 📘 Current MVP Features

### **Question Database & Practice**
- **Comprehensive Filtering**: Category (Physics, Chemistry, Biology, Math, Energy, ESS), question type (Tossup/Bonus), style (Short Answer, Multiple Choice, Identify All, Rank), source (MIT, Regionals, Nationals)
- **Text Search**: Full-text search across questions and answers
- **Practice Modes**:
  - Flashcard system with progressive reveal
  - Reading mode with text disclosure
  - Multiple choice practice
  - Support for Identify-All and Rank questions
- **Session Management**: Accuracy tracking, answer history, unseen question tracking
- **Hotkey-Driven UX**: Enter to submit, keyboard shortcuts for navigation
- **User Features**: Authentication, profiles, bookmarking, answer history

### **Tournament Management**
- **Tournament Creation**: Name, division (MS/HS), format, dates, location, organizer info
- **Team & Player Management**: Team registration, player rosters with grade levels
- **Room Assignment**: Physical/virtual room allocation with status tracking
- **Round Scheduling**: Multiple rounds with packet assignments
- **Live Dashboard**: Real-time tournament status, room progress monitoring
- **MODAQ Integration**: Read-only API for external game result ingestion
- **Player Statistics**: Points, buzzes, accuracy tracking from live games
- **Game Tracking**: Current tossup number, team scores, completion status

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

## 📂 Project Structure

```
nsb-arena/
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── features/        # Feature modules
│   │   │   ├── auth/        # Authentication (login/signup)
│   │   │   ├── questions/   # Question database UI
│   │   │   ├── study/       # Practice modes (flashcard, reading)
│   │   │   ├── tournaments/ # Tournament browsing & management
│   │   │   ├── profile/     # User profile management
│   │   │   └── [multiplayer, social, coaching]/  # Future features
│   │   ├── core/
│   │   │   └── api/         # API client for backend communication
│   │   ├── shared/
│   │   │   ├── types/       # TypeScript type definitions
│   │   │   └── utils/       # Shared utilities
│   │   ├── pages/           # Top-level pages
│   │   ├── App.tsx          # Main app router and layout
│   │   └── main.tsx         # Entry point
│   └── package.json
│
├── backend/                  # Django + PostgreSQL API
│   ├── backend/             # Django project config
│   ├── questions/           # Questions app (models, API, tests)
│   ├── tournaments/         # Tournament management app
│   ├── users/               # User management (custom User model)
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml       # Multi-container orchestration
├── README.md
├── TOURNAMENT.md            # Tournament system architecture docs
└── TESTING_SETUP.md         # Testing guide
```

---

## 📡 API Endpoints

### **Authentication** (`/api/`)
- `POST /auth/register/` - Register new user
- `POST /auth/login/` - Login (get JWT tokens)
- `POST /auth/refresh/` - Refresh access token
- `GET /profile/` - Get current user profile
- `PUT /profile/` - Update profile

### **Questions** (`/api/questions/`)
- `GET /` - List questions (supports filtering by category, type, style, source)
- `GET /<id>/` - Get question details
- `POST /history/` - Submit answer
- `GET /history/` - Get answer history
- `POST /bookmarks/` - Bookmark question
- `GET /bookmarks/` - List bookmarks

### **Tournaments** (`/api/`)
- `GET /tournaments/` - List tournaments (filterable by status, division)
- `GET /tournaments/<id>/` - Tournament details
- `GET /tournaments/<id>/teams/` - Tournament teams
- `GET /tournaments/<id>/rooms/` - Tournament rooms
- `GET /tournaments/<id>/rounds/` - Tournament rounds
- `GET /tournaments/<id>/games/` - Tournament games
- `GET /teams/` - Teams (with filtering)
- `GET /rooms/` - Rooms (with filtering)
- `GET /games/` - Games (with filtering)

**Note**: Tournament endpoints are read-only in the MVP. Write operations are reserved for MODAQ integration.

---

## 🏗️ Key Architectural Decisions

1. **Monorepo Structure**: Frontend and backend in a single repository for tight integration and easier development
2. **MODAQ Integration**: External buzzing/scoring system writes game results → Arena reads and displays (no score recalculation in Arena)
3. **Read-Heavy MVP**: All tournament endpoints are read-only; write operations reserved for MODAQ
4. **Feature-Based Frontend**: Modular folder structure organized by features for better scalability
5. **JWT Authentication**: Stateless token-based authentication for API security
6. **Docker-First Development**: Containerized environment ensures consistency across development and deployment
7. **TypeScript Throughout**: Strong typing on frontend for better developer experience and fewer runtime errors

---

## 🎯 Notable Features

- **Hotkey-Driven UX**: Keyboard shortcuts for fast navigation (Enter to submit, Skip questions, Next)
- **Multiple Question Types**: Support for Short Answer, Multiple Choice, Identify-All, and Rank questions
- **Progressive Text Reveal**: Reading mode with controlled text disclosure for practice
- **Question Randomization**: Smart selection with history tracking to avoid repeats
- **MODAQ Integration**: Designed for seamless data ingestion from external buzzing systems
- **Tournament Dashboard**: Real-time monitoring of tournament progress across multiple rooms
- **Player Analytics**: Track performance metrics including points, buzzes, and accuracy

---

## 📚 Additional Documentation

- [TOURNAMENT.md](TOURNAMENT.md) - Tournament system architecture and design decisions
- [TESTING_SETUP.md](TESTING_SETUP.md) - Testing guide and best practices

---

## 🤝 Contributing

This project is in active development. The current focus is on completing Phase 3 (Tournament Organizer tools) and refining the MVP experience.

### Adding a Tournament

Tournament listings are **hardcoded in the repository** and managed through pull requests. This approach:
- Ensures all tournaments are reviewed before appearing on the site
- Prevents spam and duplicate listings
- Works well for Science Bowl's tournament volume (~20-30 per season)

To add your tournament:
1. Edit [`apps/website/frontend/src/features/tournaments/data/tournaments.ts`](apps/website/frontend/src/features/tournaments/data/tournaments.ts)
2. Add your tournament details following the existing format
3. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed step-by-step instructions.

---

## 📄 License

This project is being developed for the National Science Bowl community.
