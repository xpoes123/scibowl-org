# 🧪 Scibowl Org
### A Modern Science Bowl Tournament & Practice Platform — React + TypeScript + Django

**Scibowl Org** is a full-stack platform designed for **National Science Bowl (NSB)** students, teams, coaches, and tournament organizers.

The mission:
> **Build the most complete, modern, competitive, and community-driven Science Bowl platform online.**

Scibowl Org provides tournament discovery and management tools, live game moderation through MOSS (our moderator platform), question packet management, and powerful post-tournament analytics. The platform aims to modernize Science Bowl tournaments while providing students and coaches with better tools for practice and competition.

The project is in **active development** with a React + TypeScript frontend and Django REST backend.

---

## 🎯 Core Features

### **Tournament Discovery & Management**
- **Tournament Listings**: Hardcoded tournament database with upcoming and past tournaments
- **Tournament Details**: Registration info, logistics, format, contact information
- **Post-Tournament Resources**: Results, statistics, and question packets
- **JSON-Based Data**: Simple file-based tournament management via pull requests
- **Community-Driven**: Tournament organizers can add their events via GitHub PRs

### **MOSS - Moderator Platform**
- **Live Game Moderation**: Platform for judges to read questions and track buzzes
- **Buzz Tracking**: Record exactly where players buzz in each question
- **Enhanced Statistics**: Detailed player and team analytics based on buzz points
- **Better Tournament Insights**: Understand player strengths and weaknesses through buzz patterns

### **Question Packets**
- **Packet Management**: Upload and organize Science Bowl question sets
- **Post-Tournament Access**: Make packets available after tournaments conclude
- **Community Resource**: Build a library of practice materials

### **Practice Tools** (In Development)
- Question database with comprehensive filtering
- Practice modes: Flashcard system, reading mode
- Session stats and answer history tracking
- User authentication and profiles

---

## 🚀 What Makes This Different

**Traditional Science Bowl Tournaments:**
- Google Sheets for scoring and standings
- Manual stat tracking
- No visibility into player buzz patterns
- Limited post-tournament analytics

**Scibowl Org Platform:**
- **MOSS**: Live game moderation with precise buzz tracking
- **Detailed Analytics**: Know exactly where players buzz, identify strengths/weaknesses
- **Tournament Discovery**: Centralized listing of Science Bowl tournaments
- **Packet Repository**: Access to past tournament questions for practice
- **Modern UX**: Built for speed and ease of use

---

## 🧰 Tech Stack

### **Frontend**
- React 19.2 (Vite 7.2)
- TypeScript 5.9
- TailwindCSS 3.4
- React Router 7.9
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

## ▶️ Getting Started

### **Monorepo Structure**
```
scibowl-org/
├── apps/
│   └── website/
│       ├── frontend/     # React + TypeScript + Vite
│       └── backend/      # Django + PostgreSQL API
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
cd apps/website/frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

**Backend:**
```bash
cd apps/website/backend

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

## 📂 Project Structure

```
scibowl-org/
├── apps/
│   └── website/
│       ├── frontend/                 # React + TypeScript + Vite
│       │   ├── src/
│       │   │   ├── features/
│       │   │   │   ├── tournaments/  # Tournament discovery & details
│       │   │   │   │   ├── data/
│       │   │   │   │   │   └── tournaments/  # JSON tournament files
│       │   │   │   │   ├── pages/
│       │   │   │   │   └── components/
│       │   │   │   ├── auth/         # Authentication
│       │   │   │   ├── questions/    # Question database
│       │   │   │   └── study/        # Practice modes
│       │   │   └── core/
│       │   │       └── api/          # API client
│       │   └── package.json
│       │
│       └── backend/                  # Django + PostgreSQL API
│           ├── backend/              # Django project config
│           ├── questions/            # Questions app
│           ├── tournaments/          # Tournament management
│           ├── users/                # User management
│           └── requirements.txt
│
├── docker-compose.yml
└── README.md
```

---

## 🤝 Contributing

### Adding a Tournament

Tournament listings are **hardcoded in the repository** and managed through pull requests. This approach:
- Ensures all tournaments are reviewed before appearing on the site
- Prevents spam and duplicate listings
- Works well for Science Bowl's tournament volume (~20-30 per season)
- Provides a git history audit trail

**To add your tournament:**

1. Create a new JSON file in [`apps/website/frontend/src/features/tournaments/data/tournaments/`](apps/website/frontend/src/features/tournaments/data/tournaments/) with the next available ID (e.g., `26.json`)

2. Use this template:
```json
{
  "id": "26",
  "name": "Your Tournament Name",
  "location_city": "City",
  "location_state": "STATE",
  "start_date": "2026-03-15",
  "level": ["HS"],
  "status": "UPCOMING",
  "updated_at": "2026-01-06T00:00:00Z",
  "is_published": true,
  "contact_info": "Contact info here",
  "logistics": "Tournament logistics details",
  "registration": {
    "method": "FORM",
    "instructions": "Registration instructions",
    "url": "https://forms.gle/...",
    "cost": "$25 per team",
    "deadlines": [
      {
        "label": "Registration closes",
        "date": "2026-03-01"
      }
    ]
  },
  "format": {
    "summary": "Tournament format description",
    "field_limit": 24,
    "phases": []
  }
}
```

3. Import your JSON file in [`tournaments.ts`](apps/website/frontend/src/features/tournaments/data/tournaments.ts)

4. Submit a pull request

**For finished tournaments**, add post-tournament resources:
```json
{
  "results_url": "https://docs.google.com/spreadsheets/...",
  "stats_url": "https://docs.google.com/spreadsheets/...",
  "packets_url": "https://drive.google.com/drive/folders/..."
}
```

See the [tournaments README](apps/website/frontend/src/features/tournaments/data/tournaments/README.md) for more details.

---

## 🏗️ Key Architectural Decisions

1. **Hardcoded Tournament Data**: Simple JSON files managed via GitHub PRs for spam prevention and human review
2. **MOSS Integration**: External moderation platform tracks game state and buzz points for enhanced analytics
3. **Feature-Based Frontend**: Modular folder structure organized by features for better scalability
4. **JWT Authentication**: Stateless token-based authentication for API security
5. **Docker-First Development**: Containerized environment ensures consistency across development and deployment
6. **TypeScript Throughout**: Strong typing on frontend for better developer experience and fewer runtime errors

---

## 📄 License

This project is being developed for the National Science Bowl community.
