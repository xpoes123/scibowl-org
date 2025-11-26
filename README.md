# 🧪 Scibowl Org
### A Science Bowl Practice Platform — Built with React + TypeScript (MVP In Progress)

Scibowl Org is a full-stack platform designed to help students, teams, and coaches practice for **National Science Bowl** competitions.  
This repository currently contains the **frontend codebase** for the MVP, built with **React + TypeScript**, with early features including:

- Question browser  
- Search (min 2 chars)  
- Category filtering  
- Conditional result rendering  
- Modular components (`QuestionList`, `QuestionCard`)  
- Early UI scaffolding for future pages

Backend (Django/DRF + Postgres) will be added in later phases according to the roadmap below.

---

# 🚀 Current Status (Early MVP)

The project is in **Week 1–2** of the 16-week MVP schedule.

**Completed so far:**
- React + TypeScript setup  
- Static question dataset  
- Search input with feedback states  
- Category dropdown filter  
- `QuestionList` + `QuestionCard` components  
- Basic conditional UI  
- Initial file structure

**In progress:**
- Practice Mode (short-answer MVP)
- Establishing global layout + CSS approach (Tailwind or custom)

---

# 📂 Folder Structure (Current)

```
src/
  App.tsx
  components/
    QuestionList.tsx
    QuestionCard.tsx
  data/
    questions.ts
  pages/
  types/
  utils/
```

---

# 🧰 Tech Stack

- **React** (Vite)
- **TypeScript**
- **CSS** (migrating toward Tailwind)
- **Django + DRF** (backend, upcoming)
- **PostgreSQL** (backend DB, upcoming)

---

# 🧠 Core MVP Features

### **Question DB**
- PDF/ZIP parsing  
- Search + filtering  
- Question submission  
- Voting system  
- Reporting / tagging  
- Beta/approved status  

### **Practice Mode**
- Short answer  
- Multiple choice / multiple select  
- Practice filters  
- Slow read mode  
- Answer verification  
- Practice history  
- Difficulty rating / Elo metric  

### **Analytics**
- Accuracy, attempts, category performance  
- Question analytics dashboard  

### **Accounts**
- Login/signup  
- Profile page  
- Optional OAuth  

### **Static Pages**
- Resources  
- Tournaments  
- Coming soon pages for Arenas, Queue, Teams, Coach  

---

# 📆 16-Week Roadmap (Summary)

### **Weeks 1–3 — Frontend Foundation**
- Build Question Browser UI  
- Practice Mode MVP  
- CSS structure

### **Weeks 4–6 — Backend + DB**
- Django/DRF setup  
- Question Model  
- Search + filters  
- PDF parser + upload  
- Question migration

### **Weeks 7–9 — Practice + Analytics**
- MCQ support  
- Skip button  
- Answer validation  
- Practice history  
- Analytics MVP

### **Weeks 10–12 — Accounts + Static Pages**
- Login system  
- Profile page  
- Resources & Tournaments pages

### **Weeks 13–16 — Infra + Stretch**
- Environment variables  
- Logging  
- Dockerization  
- OAuth  
- Final polish  

---

# ▶️ Getting Started

```
npm install
npm run dev
```

Runs at:  
`http://localhost:5173`

---

# 📄 License  
MIT License (or TBD)

---

# 📬 Contact  
Created by **David Jiang**  
