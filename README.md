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

### **Backend (upcoming)**
- Django + DRF
- PostgreSQL
- Redis (match + real-time)
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

```bash
npm install
npm run dev
