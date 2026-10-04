# QuizMatrix 🎯

A modern full-stack assessment and quiz platform powered by **Spring Boot**, **PostgreSQL**, and a responsive **Web Frontend**.

---

## 🏗️ Architecture Overview

The repository is structured into two main components:
- **`Quizzapp/`**: Spring Boot REST API backend handling question banks, dynamic quiz generation, answer verification, scoring, and PostgreSQL database integration.
- **`frontend/`**: Modern, aesthetic web application with dark mode UI, quiz launcher, live session timer, keyboard shortcuts, score analytics, and confetti celebrations.

---

## ✨ Features

- **Dynamic Quiz Generation**: Assembles random quizzes on-demand based on category and question count.
- **Real-Time Assessment Player**: Timer, question palette navigation, keyboard shortcuts (`1-4` / `A-D`), and instant score calculation.
- **Question Repository & Management**: Live keyword search, category filtering, and modal to add new questions to PostgreSQL.
- **Secure Evaluation**: Question choices are transferred without exposing correct answers until submission.
- **CORS Configured**: Spring Boot backend pre-configured to communicate seamlessly with frontend clients.

---

## 🛠️ Tech Stack

- **Backend**: Java 17+, Spring Boot, Spring Data JPA, Hibernate, PostgreSQL
- **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphism Design System), Modern ES6+ JavaScript
- **Build Tool**: Maven (`./mvnw`)

---

## 🚀 Getting Started

### 1. Database Setup (PostgreSQL)
Create a PostgreSQL database named `quizdb`:
```sql
CREATE DATABASE quizdb;
```
Ensure your database password is set in your environment or updated in `Quizzapp/src/main/resources/application.properties`:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/quizdb
spring.datasource.username=postgres
spring.datasource.password=${DB_PASSWORD}
```

### 2. Run the Backend
Navigate to the `Quizzapp` directory and launch Spring Boot:
```bash
cd Quizzapp
./mvnw spring-boot:run
```
The REST API will start on `http://localhost:8080`.

### 3. Run the Frontend
You can open `frontend/index.html` directly in any web browser, or serve it using any HTTP server:
```bash
# Using Python built-in server
cd frontend
python -m http.server 3000
```
Open `http://localhost:3000` in your browser.

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/question/allQuestions` | Retrieve all questions in database |
| `GET` | `/question/category/{category}` | Filter questions by category |
| `POST` | `/question/add` | Add a new question to the repository |
| `POST` | `/quiz/create?category={cat}&numQ={num}&title={title}` | Generate a new quiz |
| `GET` | `/quiz/get/{id}` | Retrieve quiz questions (without answers) |
| `POST` | `/quiz/submit/{id}` | Submit answers and receive score |

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
