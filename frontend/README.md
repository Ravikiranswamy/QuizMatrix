# QuizMatrix — Production-Grade Assessment Frontend

QuizMatrix is a modern, responsive web application built with **HTML5, Vanilla CSS, and JavaScript**, designed to interface directly with the Spring Boot Quiz REST API.

---

## 🌟 Key Features

1. **Aesthetic & Responsive UI**:
   - Built with obsidian dark theme, electric indigo/violet gradients, frosted glass panels, and smooth micro-animations.
   - Clean typography using Google Fonts (**Plus Jakarta Sans** and **JetBrains Mono**).
   - Fully responsive on mobile, tablet, and widescreen desktop.

2. **Quizzes Hub**:
   - Direct Quiz Launcher by Quiz ID.
   - Card grid of available quizzes and quick practice categories.
   - Real-time stats on available questions, categories, and backend status.

3. **Active Quiz Player**:
   - Live session timer with formatting and visual warning states.
   - Animated progress bar and question tracker (`Question X of Y`).
   - Interactive question palette (jump to question, answered indicators, flagged questions).
   - Hotkeys: Press `1`-`4` or `A`-`D` to select choices; `Left`/`Right` arrow keys to navigate; `F` to flag.
   - Answer review & submission confirmation modal.

4. **Polished Results Screen**:
   - Animated circular score gauge with dynamic accuracy percentage.
   - Metric cards: Correct answers ratio, time taken, and mastery level badge.
   - Lightweight canvas confetti celebration for scores ≥ 70%.
   - Synthetic audio cues (Web Audio API - no external sound files required).
   - Question review drawer comparing answers.

5. **Question Repository & Management**:
   - Live search filter by keyword, option, or question title.
   - Dynamic category filtering matching real categories from your PostgreSQL database (e.g., Java, DSA).
   - Modal to add new questions directly to the database via `POST /question/add`.

6. **Create Assessment**:
   - Generates random quizzes through `POST /quiz/create?category=...&numQ=...&title=...`.

7. **Direct PostgreSQL & Spring Boot Integration**:
   - Pings `http://localhost:8080/question/allQuestions` to verify live backend health.
   - All questions, categories, quizzes, and assessment evaluations run 100% against your live PostgreSQL database.
   - Configurable Backend Base URL in Settings.

---

## 🚀 How to Run the Frontend

You can run this frontend with any static file server or directly in your browser:

### Option 1: VS Code Live Server / Any Local Server
If using VS Code, right-click `frontend/index.html` and choose **"Open with Live Server"**.

### Option 2: Python HTTP Server (Built-in)
In PowerShell or Terminal:
```powershell
cd "c:\Users\Ravikiran Swamy\Downloads\Documents\Projects\QuizAppWithFrontend\frontend"
python -m http.server 3000
```
Then open `http://localhost:3000` in your browser.

### Option 3: Direct Browser Launch
Simply double-click `frontend/index.html` to open it in Chrome, Edge, or Firefox.

---

## 🔗 Connected Spring Boot Endpoints

| Backend Endpoint | Method | Purpose in Frontend |
| :--- | :--- | :--- |
| `/question/allQuestions` | `GET` | Fetches all repository questions & checks API health |
| `/question/category/{category}` | `GET` | Filters questions by category |
| `/question/add` | `POST` | Saves a new question created in the modal |
| `/quiz/create` | `POST` | Assembles a new quiz with random questions |
| `/quiz/get/{id}` | `GET` | Retrieves quiz questions without exposing right answers |
| `/quiz/submit/{id}` | `POST` | Submits answers in sequential order and returns total score |
