# 🧪 Scibowl Org
### A Science Bowl Practice Platform — Built with React + TypeScript (MVP In Progress)

Scibowl Org is a full-stack platform designed to help students, teams, and coaches practice for **National Science Bowl (NSB)** competitions.

The app is currently in **active MVP development**, with the frontend built using **React + TypeScript** and the backend (Django + DRF + PostgreSQL) arriving in the next development phase.

The goal of Scibowl Org is to provide:
- the best NSB study experience online,
- competitive play (1v1, rooms, team scrimmages),
- question writing + submission tools,
- coach dashboards,
- advanced analytics,
- LLM-powered tutoring and explanations.

---

# 🚀 Current Status (MVP Development)

### **Completed so far**
- React + TypeScript base
- Static question dataset
- Search
- Category filters
- `QuestionList` + `QuestionCard` components
- Basic study mode groundwork
- Conditional UI states
- Initial layout and component system

### **In Progress**
- Practice Mode (short answer, flashcard, timed)
- Improved search options
- Answer validation + override system
- Layout + visual design decisions

---

# 🧰 Tech Stack

### **Frontend**
- React (Vite)
- TypeScript
- TailwindCSS

### **Backend (upcoming)**
- Django + Django REST Framework
- PostgreSQL
- Optional Redis for match features
- Docker + environment configuration

---

# 🧠 MVP Features (v0.x)

## **📘 Question Database**
- Ingest ~10% of QBReader question sets
- View full packets or generate random packets
- Search + category filtering
- PDF/ZIP upload for packets
- User question submissions (single and packet)
- Difficulty & quality ratings (Alcumus-style)
- Report issues / bug flagging

## **🎯 Study Mode**
- Flashcard mode
- Timed mode
- Basic text reading / slow read mode
- Answer validation with override
- Practice filters (category, year, difficulty)

## **🔔 Solo Play**
- Tossup-style practice (qbreader-style reader)
- Smooth filters and searching
- Override system acts as reporting mechanism
- Begin per-session stats tracking

## **📤 User Question System**
- Submit questions (single or packet)
- Rate questions (difficulty + quality)
- Report bad or incorrect questions
- Submission leaderboards

## **⚔️ 1v1 Polling-Based Matches**
- Low-latency polling race
- Buzz lock
- Judge answer via override
- Basic scoring and results page

## **👤 Accounts & Profiles**
- OAuth login
- Basic profile page
- Stats Dashboard MVP

## **📈 Social Features**
- Solo leaderboards
- Submission leaderboards

## **🤖 LLM Integrations**
- Cheap LLM explanations
- Paraphrasing / simplified explanations

## **📘 Static Pages**
- Resources page
- “Coming soon” pages for:
  - Teams
  - Coach Dashboard
  - Scrimmage Rooms
  - Ranked

---

# 🧭 V1 Feature Set (Post-Launch Upgrade)

## **📘 Database & Search**
- Full question ingestion (all QBReader sets)
- Automated submission → ingestion pipeline
- Difficulty system
- Advanced search (AND/OR)
- Buzzpoint statistics
- Public packet browser

## **🎯 Study Mode 2.0**
- Adjustable timers
- “Reveal next word” mode
- Save/revisit questions
- Session summaries
- Bookmarking

## **🔔 Solo Mode 2.0**
- Better animations
- Smarter validation
- Tossup/bonus support

## **🏟️ Match Rooms**
- Configurable settings
- Real-time buzzing (WebSockets)
- Overrides with consensus
- Bonuses + full cycle
- Rating system (Elo v1)
- Match history + replay
- Per-match dashboards

## **📤 Submission Dashboard 2.0**
- Edit submissions based on feedback
- Inline feedback
- Better PDF parsing
- Automated formatting checks
- Trusted submitter system

## **🛡 Moderator Dashboard**
- Approve/deny submissions
- Resolve reported questions
- Merge duplicates
- Manage trusted users

## **👤 Profiles 2.0**
- Graphs & radar charts
- Tossup/bonus analytics
- Buzzpoint speed profile
- Recent matches
- Submission dashboard

## **📈 Analytics & Insights**
- Weak topic detection
- Recommended questions
- Study paths
- Category heatmaps

## **🏆 Leaderboards**
- Weekly, Monthly, All-time
- 1v1 rating leaderboard
- Submission / editing leaderboards
- School leaderboards

## **🎖 Achievements**
- Packet finisher
- Perfect sessions
- Streaks
- Submission milestones

## **🤖 LLM Upgrades**
- Tiered explanations
- RAG system
- Distractor analysis

## **👥 Team System**
- Team creation
- Team dashboards
- Roster, practice stats, leaderboards

## **🎓 Coach Dashboard**
- Assign practice packets
- Writing assignments
- Category breakdowns
- Weak topic identification

## **👨‍🏫 Team Practice Room**
- Coach controls reading
- Join via code
- Live buzzing & scoring
- Replays & stats

---

# ▶️ Getting Started

```
npm install
npm run dev
```

Runs at:  
http://localhost:5173

---

# 📄 License
MIT License (or TBD)

---

# 📬 Contact
Created by **David Jiang**
