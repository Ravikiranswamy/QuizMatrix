/**
 * QuizMatrix — Production-Grade Assessment Engine
 * Frontend Controller & API Integration Layer
 */

// ============================================================================
// CONFIGURATION & GLOBAL STATE
// ============================================================================
const state = {
  activeView: 'quizzes',
  api: {
    baseUrl: localStorage.getItem('quiz_api_url') || 'http://localhost:8080',
    isOnline: false,
    soundEnabled: localStorage.getItem('quiz_sound_enabled') !== 'false'
  },
  questionBank: [],
  categories: new Set(),
  activeQuiz: {
    id: null,
    title: '',
    questions: [],
    currentIndex: 0,
    answers: {},       // { [questionIndex]: selectedText }
    flagged: new Set(),// Set of indices
    startTime: null,
    timerSeconds: 0,
    timerInterval: null,
    isPractice: false
  },
  lastResult: null
};

// ============================================================================
// DATABASE QUIZZES REPOSITORY (Persisted Created Quizzes & Database Access)
// ============================================================================
const STORAGE_QUIZZES_KEY = 'quiz_matrix_database_quizzes';

function getDatabaseQuizzes() {
  try {
    const raw = localStorage.getItem(STORAGE_QUIZZES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse saved quizzes', e);
  }
  // Initialize with the active quiz #1 existing in the PostgreSQL database
  return [
    {
      id: 1,
      title: 'Database Assessment Quiz #1',
      category: 'Java',
      questionCount: 5
    }
  ];
}

function saveDatabaseQuiz(newQuiz) {
  const current = getDatabaseQuizzes();
  const updated = [newQuiz, ...current.filter(q => q.id !== newQuiz.id)];
  localStorage.setItem(STORAGE_QUIZZES_KEY, JSON.stringify(updated));
  return updated;
}

// ============================================================================
// SYNTHETIC AUDIO ENGINE (Web Audio API - Zero External Dependencies)
// ============================================================================
const audio = {
  ctx: null,
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  },
  play(type) {
    if (!state.api.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'select') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'success') {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const noteOsc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          noteOsc.connect(noteGain);
          noteGain.connect(this.ctx.destination);
          noteOsc.frequency.setValueAtTime(freq, now + idx * 0.09);
          noteGain.gain.setValueAtTime(0.08, now + idx * 0.09);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.25);
          noteOsc.start(now + idx * 0.09);
          noteOsc.stop(now + idx * 0.09 + 0.25);
        });
      }
    } catch (e) {
      // AudioContext policy catch
    }
  }
};

// ============================================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================================
function showToast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'success' 
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    : type === 'error'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

  toast.innerHTML = `
    ${iconSvg}
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================================
// API CLIENT SERVICE
// ============================================================================
const api = {
  // Test connection to Spring Boot backend
  async ping() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      console.log(`[API Ping] Testing connection to ${state.api.baseUrl}/question/allQuestions...`);
      const res = await fetch(`${state.api.baseUrl}/question/allQuestions`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        console.log('[API Ping] Success! Backend connected.');
        this.setOnline(true);
        return true;
      } else {
        console.warn(`[API Ping] Backend responded with HTTP status ${res.status}`);
      }
    } catch (err) {
      console.warn('[API Ping] Backend is currently unreachable at ' + state.api.baseUrl, err);
    }

    this.setOnline(false);
    return false;
  },

  setOnline(isOnline) {
    state.api.isOnline = isOnline;
    const badge = document.getElementById('api-status-badge');
    const text = document.getElementById('api-status-text');
    const offlineBanner = document.getElementById('demo-banner');
    const statPort = document.getElementById('stat-api-status');

    if (statPort) {
      statPort.textContent = isOnline ? '8080 (Live)' : 'Offline';
    }

    if (!badge || !text) return;

    badge.classList.remove('online', 'demo', 'offline');

    if (isOnline) {
      badge.classList.add('online');
      text.textContent = 'Backend: Online (8080)';
      badge.title = 'Connected to Spring Boot & PostgreSQL database';
      if (offlineBanner) offlineBanner.style.display = 'none';
    } else {
      badge.classList.add('offline');
      text.textContent = 'Backend: Offline (8080)';
      badge.title = 'Spring Boot backend unreachable at ' + state.api.baseUrl;
      if (offlineBanner) offlineBanner.style.display = 'flex';
    }
  },

  // GET /question/allQuestions (Returns real questions from database)
  async getAllQuestions() {
    try {
      const res = await fetch(`${state.api.baseUrl}/question/allQuestions`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (err) {
      console.error('API fetch allQuestions failed:', err);
    }
    return [];
  },

  // GET /question/category/{category} (Returns questions filtered from database)
  async getQuestionsByCategory(category) {
    try {
      const res = await fetch(`${state.api.baseUrl}/question/category/${encodeURIComponent(category)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (err) {
      console.error('API getQuestionsByCategory failed:', err);
    }
    return [];
  },

  // POST /question/add (Saves new question to PostgreSQL database)
  async addQuestion(questionData) {
    const res = await fetch(`${state.api.baseUrl}/question/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData)
    });
    if (!res.ok) throw new Error(`Database insert failed (HTTP ${res.status})`);
    return await res.text();
  },

  // POST /quiz/create?category=...&numQ=...&title=... (Creates quiz in PostgreSQL database)
  async createQuiz(category, numQ, title) {
    const url = new URL(`${state.api.baseUrl}/quiz/create`);
    url.searchParams.append('category', category);
    url.searchParams.append('numQ', numQ);
    url.searchParams.append('title', title);

    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) throw new Error(`Create quiz failed (HTTP ${res.status})`);
    return await res.text();
  },

  // GET /quiz/get/{id} (Fetches wrapped quiz questions from PostgreSQL database)
  async getQuizQuestions(quizId) {
    const res = await fetch(`${state.api.baseUrl}/quiz/get/${quizId}`);
    if (!res.ok) throw new Error(`Quiz #${quizId} not found in database (HTTP ${res.status})`);
    const data = await res.json();
    if (!data || data.length === 0) {
      throw new Error(`Quiz #${quizId} has no questions or was not found in the database.`);
    }
    return data;
  },

  // POST /quiz/submit/{id} (Evaluates score with Spring Boot against PostgreSQL database)
  async submitQuiz(quizId, responses) {
    const res = await fetch(`${state.api.baseUrl}/quiz/submit/${quizId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(responses)
    });
    if (!res.ok) throw new Error(`Submit failed with HTTP status ${res.status}`);
    return await res.json(); // returns integer score from Spring Boot
  }
};

// ============================================================================
// VIEW SWITCHING SYSTEM
// ============================================================================
function switchView(viewName) {
  state.activeView = viewName;

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const activePanel = document.getElementById(`view-${viewName}`);
  if (activePanel) {
    activePanel.classList.add('active');
  }

  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.dataset.view === viewName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Trigger view specific reloads
  if (viewName === 'quizzes') {
    renderQuizzesView();
  } else if (viewName === 'questions') {
    renderQuestionsView();
  } else if (viewName === 'create-quiz') {
    populateCreateQuizCategories();
  }
}

// ============================================================================
// QUIZZES HUB & DIRECT PLAY
// ============================================================================
async function renderQuizzesView() {
  const grid = document.getElementById('quizzes-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

  try {
    // Load question repository directly from database
    const questions = await api.getAllQuestions();
    state.questionBank = questions;

    // Categories dynamically extracted from database questions
    const categories = new Set(questions.map(q => q.category).filter(Boolean));
    state.categories = categories;

    document.getElementById('stat-total-questions').textContent = questions.length;
    document.getElementById('stat-categories-count').textContent = categories.size;

    grid.innerHTML = '';

    const databaseQuizzes = getDatabaseQuizzes();

    // Render Quizzes saved / created from database
    databaseQuizzes.forEach(quiz => {
      const card = document.createElement('div');
      card.className = 'quiz-card';
      card.innerHTML = `
        <div class="quiz-card-header">
          <span class="quiz-card-id mono">QUIZ #${quiz.id}</span>
          <span class="badge badge-category">${quiz.category || 'Database'}</span>
        </div>
        <h3 class="quiz-card-title">${quiz.title}</h3>
        <div class="quiz-card-meta">
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${(quiz.questionCount || 5) * 1.5} Mins
          </span>
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            </svg>
            ${quiz.questionCount || 5} Questions
          </span>
        </div>
        <div class="quiz-card-footer">
          <span class="badge badge-medium">Database Ready</span>
          <button class="btn btn-primary btn-sm btn-play-quiz" data-quiz-id="${quiz.id}" data-quiz-title="${quiz.title}">
            <span>Start Test</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Add Dynamic Category Practice Cards for all categories in database
    categories.forEach(cat => {
      const catQuestions = questions.filter(q => q.category === cat);
      if (catQuestions.length > 0) {
        const practiceCard = document.createElement('div');
        practiceCard.className = 'quiz-card';
        practiceCard.style.borderStyle = 'dashed';
        practiceCard.innerHTML = `
          <div class="quiz-card-header">
            <span class="badge badge-easy">Practice Mode</span>
            <span class="badge badge-category">${cat}</span>
          </div>
          <h3 class="quiz-card-title">${cat} Quick Practice</h3>
          <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Practice all ${catQuestions.length} questions loaded from the database.
          </p>
          <div class="quiz-card-footer">
            <span class="mono" style="font-size: 0.75rem; color: var(--text-muted);">${catQuestions.length} Questions</span>
            <button class="btn btn-secondary btn-sm btn-practice-cat" data-category="${cat}">
              Launch Practice
            </button>
          </div>
        `;
        grid.appendChild(practiceCard);
      }
    });

    if (databaseQuizzes.length === 0 && categories.size === 0) {
      grid.innerHTML = `
        <div style="padding: 3rem; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">
          No questions found in the database. Please ensure your Spring Boot server and PostgreSQL database are running.
        </div>
      `;
    }

    // Attach play listeners
    document.querySelectorAll('.btn-play-quiz').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.play('click');
        startQuizSession(btn.dataset.quizId, btn.dataset.quizTitle);
      });
    });

    document.querySelectorAll('.btn-practice-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.play('click');
        startPracticeSession(btn.dataset.category);
      });
    });

  } catch (err) {
    grid.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--color-danger); grid-column: 1 / -1;">
        Failed to load database questions: ${err.message}. Please check your backend connection.
      </div>
    `;
  }
}

// ============================================================================
// START & RUN QUIZ SESSION
// ============================================================================
async function startQuizSession(quizId, quizTitle = '') {
  showToast(`Loading Quiz #${quizId}...`, 'info');

  try {
    const rawQuestions = await api.getQuizQuestions(quizId);

    state.activeQuiz = {
      id: quizId,
      title: quizTitle || `Quiz #${quizId} Assessment`,
      questions: rawQuestions,
      currentIndex: 0,
      answers: {},
      flagged: new Set(),
      startTime: Date.now(),
      timerSeconds: 0,
      timerInterval: null,
      isPractice: false
    };

    startQuizInterface();
  } catch (err) {
    showToast(err.message || `Could not start Quiz #${quizId}`, 'error');
  }
}

function startPracticeSession(category) {
  const catQuestions = state.questionBank.filter(q => q.category === category);
  if (!catQuestions.length) {
    showToast(`No questions found for ${category}`, 'error');
    return;
  }

  state.activeQuiz = {
    id: `practice-${category}`,
    title: `${category} Assessment Practice`,
    questions: catQuestions,
    currentIndex: 0,
    answers: {},
    flagged: new Set(),
    startTime: Date.now(),
    timerSeconds: 0,
    timerInterval: null,
    isPractice: true
  };

  startQuizInterface();
}

function startQuizInterface() {
  switchView('quiz-player');

  document.getElementById('player-quiz-title').textContent = state.activeQuiz.title;
  document.getElementById('player-quiz-subtitle').textContent = 
    `${state.activeQuiz.questions.length} Questions | Multiple Choice`;

  // Start Timer
  if (state.activeQuiz.timerInterval) {
    clearInterval(state.activeQuiz.timerInterval);
  }

  state.activeQuiz.timerSeconds = 0;
  const timerDigits = document.getElementById('player-timer-digits');

  state.activeQuiz.timerInterval = setInterval(() => {
    state.activeQuiz.timerSeconds++;
    const mins = String(Math.floor(state.activeQuiz.timerSeconds / 60)).padStart(2, '0');
    const secs = String(state.activeQuiz.timerSeconds % 60).padStart(2, '0');
    if (timerDigits) {
      timerDigits.textContent = `${mins}:${secs}`;
    }
  }, 1000);

  renderPalette();
  renderCurrentQuestion();
}

// Render the 1, 2, 3... mini question navigator palette
function renderPalette() {
  const palette = document.getElementById('player-palette');
  if (!palette) return;

  palette.innerHTML = '';
  const total = state.activeQuiz.questions.length;

  for (let i = 0; i < total; i++) {
    const btn = document.createElement('button');
    btn.className = 'palette-btn';
    btn.textContent = i + 1;
    btn.title = `Jump to Question ${i + 1}`;

    if (i === state.activeQuiz.currentIndex) {
      btn.classList.add('active');
    }
    if (state.activeQuiz.answers[i] !== undefined) {
      btn.classList.add('answered');
    }
    if (state.activeQuiz.flagged.has(i)) {
      btn.classList.add('flagged');
    }

    btn.addEventListener('click', () => {
      audio.play('click');
      state.activeQuiz.currentIndex = i;
      renderPalette();
      renderCurrentQuestion();
    });

    palette.appendChild(btn);
  }
}

// Render the active question card and 4 options
function renderCurrentQuestion() {
  const qIndex = state.activeQuiz.currentIndex;
  const q = state.activeQuiz.questions[qIndex];
  if (!q) return;

  const total = state.activeQuiz.questions.length;

  // Counter & Progress
  document.getElementById('player-step-counter').textContent = `Question ${qIndex + 1} of ${total}`;
  const pct = Math.round(((qIndex + 1) / total) * 100);
  document.getElementById('player-progress-pct').textContent = `${pct}%`;
  document.getElementById('player-progress-fill').style.width = `${pct}%`;

  // Question metadata
  document.getElementById('player-question-id').textContent = `#${q.id || (qIndex + 1)}`;
  document.getElementById('player-question-category').textContent = q.category || 'General';
  document.getElementById('player-question-text').textContent = q.questionTitle || q.title || 'Question prompt';

  // Flag Button State
  const flagBtn = document.getElementById('btn-quiz-flag');
  const flagText = document.getElementById('flag-btn-text');
  if (state.activeQuiz.flagged.has(qIndex)) {
    flagBtn.classList.remove('btn-secondary');
    flagBtn.classList.add('btn-warning');
    flagText.textContent = 'Flagged';
  } else {
    flagBtn.classList.remove('btn-warning');
    flagBtn.classList.add('btn-secondary');
    flagText.textContent = 'Flag for Review';
  }

  // Previous / Next Buttons
  document.getElementById('btn-quiz-prev').disabled = qIndex === 0;
  const nextBtn = document.getElementById('btn-quiz-next');
  if (qIndex === total - 1) {
    nextBtn.textContent = 'Review Answers';
  } else {
    nextBtn.innerHTML = `
      Next
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
  }

  // Render 4 Options
  const optionsList = document.getElementById('player-options-list');
  optionsList.innerHTML = '';

  const options = [
    { key: 'A', text: q.option1 },
    { key: 'B', text: q.option2 },
    { key: 'C', text: q.option3 },
    { key: 'D', text: q.option4 }
  ];

  const selectedAnswer = state.activeQuiz.answers[qIndex];

  options.forEach(opt => {
    const isSelected = selectedAnswer === opt.text;
    const optCard = document.createElement('div');
    optCard.className = `option-card ${isSelected ? 'selected' : ''}`;
    optCard.setAttribute('tabindex', '0');
    optCard.setAttribute('role', 'radio');
    optCard.setAttribute('aria-checked', isSelected ? 'true' : 'false');

    optCard.innerHTML = `
      <div class="option-key">${opt.key}</div>
      <div class="option-text">${opt.text}</div>
      <div class="option-check">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    `;

    optCard.addEventListener('click', () => {
      audio.play('select');
      selectOption(qIndex, opt.text);
    });

    optionsList.appendChild(optCard);
  });
}

function selectOption(qIndex, optionText) {
  state.activeQuiz.answers[qIndex] = optionText;
  renderPalette();
  renderCurrentQuestion();
}

function clearOption(qIndex) {
  delete state.activeQuiz.answers[qIndex];
  renderPalette();
  renderCurrentQuestion();
  showToast('Selection cleared', 'info', 1500);
}

// ============================================================================
// SUBMISSION & RESULT FLOW
// ============================================================================
function promptSubmitConfirmation() {
  const total = state.activeQuiz.questions.length;
  const answeredCount = Object.keys(state.activeQuiz.answers).length;
  const unansweredCount = total - answeredCount;

  const modal = document.getElementById('modal-confirm-submit');
  const msg = document.getElementById('confirm-submit-message');
  const warning = document.getElementById('unanswered-warning');

  msg.textContent = `You have answered ${answeredCount} of ${total} questions.`;

  if (unansweredCount > 0) {
    warning.style.display = 'block';
    warning.textContent = `⚠️ You have ${unansweredCount} unanswered question(s). You can still submit now or go back to complete them.`;
  } else {
    warning.style.display = 'none';
  }

  modal.classList.add('active');
}

async function finalizeSubmission() {
  const modal = document.getElementById('modal-confirm-submit');
  if (modal) modal.classList.remove('active');

  clearInterval(state.activeQuiz.timerInterval);

  showToast('Grading submission with Spring Boot backend...', 'info');

  const quiz = state.activeQuiz;
  const total = quiz.questions.length;

  // Format responses array:
  // IMPORTANT: The backend compares sequentially: questions.get(i).getRightAnswer().
  // Therefore, response order MUST strictly match the quiz questions list order!
  const responses = quiz.questions.map((q, idx) => ({
    id: q.id,
    response: quiz.answers[idx] || ""
  }));

  let score = 0;
  try {
    if (quiz.isPractice) {
      // Direct practice scoring
      quiz.questions.forEach((q, idx) => {
        if (quiz.answers[idx] === q.rightAnswer) {
          score++;
        }
      });
    } else {
      score = await api.submitQuiz(quiz.id, responses);
    }
  } catch (err) {
    showToast(`Grading error (${err.message}). Using local evaluator.`, 'error');
    score = 0;
  }

  const mins = String(Math.floor(quiz.timerSeconds / 60)).padStart(2, '0');
  const secs = String(quiz.timerSeconds % 60).padStart(2, '0');
  const timeFormatted = `${mins}:${secs}`;

  state.lastResult = {
    quizTitle: quiz.title,
    score,
    total,
    percentage: Math.round((score / total) * 100),
    timeTaken: timeFormatted,
    questions: quiz.questions,
    answers: quiz.answers
  };

  renderResultScreen(state.lastResult);
}

function renderResultScreen(result) {
  switchView('result');

  const pct = result.percentage;
  document.getElementById('result-pct').textContent = `${pct}%`;
  document.getElementById('result-score-metric').textContent = `${result.score} / ${result.total}`;
  document.getElementById('result-time-metric').textContent = result.timeTaken;

  // Animated Gauge
  const gaugeBar = document.getElementById('result-gauge-bar');
  if (gaugeBar) {
    const circumference = 2 * Math.PI * 70; // 439.8
    const offset = circumference - (pct / 100) * circumference;
    gaugeBar.style.strokeDasharray = `${circumference}`;
    gaugeBar.style.strokeDashoffset = `${circumference}`;
    setTimeout(() => {
      gaugeBar.style.strokeDashoffset = `${offset}`;
    }, 150);
  }

  // Verdict Headline & Badge
  const titleEl = document.getElementById('result-verdict-title');
  const subheadEl = document.getElementById('result-verdict-subtitle');
  const rankEl = document.getElementById('result-rank-metric');

  if (pct >= 85) {
    titleEl.textContent = "Outstanding Mastery! 🏆";
    subheadEl.textContent = "Exceptional conceptual depth and precision across all questions.";
    rankEl.textContent = "Distinction";
    rankEl.style.color = "#10b981";
    triggerConfetti();
    audio.play('success');
  } else if (pct >= 60) {
    titleEl.textContent = "Well Done! 🚀";
    subheadEl.textContent = "Solid performance. A quick review of missed concepts will secure top marks.";
    rankEl.textContent = "Proficient";
    rankEl.style.color = "#6366f1";
    audio.play('success');
  } else {
    titleEl.textContent = "Keep Practicing! 💡";
    subheadEl.textContent = "Every test is a step toward mastery. Review the solutions below and try again.";
    rankEl.textContent = "Apprentice";
    rankEl.style.color = "#f59e0b";
  }

  // Prepare submission review list
  const reviewList = document.getElementById('result-review-list');
  reviewList.innerHTML = '';

  result.questions.forEach((q, idx) => {
    const userChoice = result.answers[idx] || "No answer provided";
    const item = document.createElement('div');
    item.className = 'q-item';
    item.innerHTML = `
      <div class="q-item-header">
        <span class="mono" style="font-size: 0.8125rem; color: var(--accent-primary);">Question ${idx + 1}</span>
        <span class="badge ${userChoice === q.rightAnswer || !q.rightAnswer ? 'badge-easy' : 'badge-hard'}">
          ${userChoice === q.rightAnswer ? 'Correct' : 'Completed'}
        </span>
      </div>
      <div class="q-item-title">${q.questionTitle}</div>
      <div style="font-size: 0.875rem; margin-top: 0.35rem;">
        <span style="color: var(--text-muted);">Your Selection: </span>
        <strong style="color: var(--text-main);">${userChoice}</strong>
      </div>
      ${q.rightAnswer ? `
        <div style="font-size: 0.875rem;">
          <span style="color: var(--color-success);">Correct Answer: </span>
          <strong>${q.rightAnswer}</strong>
        </div>
      ` : ''}
    `;
    reviewList.appendChild(item);
  });
}

// ============================================================================
// QUESTION BANK MANAGEMENT
// ============================================================================
async function renderQuestionsView() {
  const container = document.getElementById('questions-list-container');
  const countBadge = document.getElementById('questions-count-badge');
  const searchInput = document.getElementById('filter-question-search');
  const catSelect = document.getElementById('filter-question-category');

  if (!container) return;

  container.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

  try {
    const questions = await api.getAllQuestions();
    state.questionBank = questions;

    // Populate category dropdown
    const categories = Array.from(new Set(questions.map(q => q.category).filter(Boolean)));
    catSelect.innerHTML = '<option value="ALL">All Categories</option>';
    categories.forEach(cat => {
      catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });

    function applyFilter() {
      const query = (searchInput.value || '').toLowerCase();
      const selectedCat = catSelect.value;

      const filtered = state.questionBank.filter(q => {
        const matchesCategory = selectedCat === 'ALL' || q.category === selectedCat;
        const matchesQuery = !query || 
          q.questionTitle.toLowerCase().includes(query) ||
          (q.category && q.category.toLowerCase().includes(query)) ||
          q.option1.toLowerCase().includes(query) ||
          q.option2.toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
      });

      countBadge.textContent = `${filtered.length} Questions Found`;
      container.innerHTML = '';

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
            No matching questions found. Try modifying your search or add a new question.
          </div>
        `;
        return;
      }

      filtered.forEach(q => {
        const item = document.createElement('div');
        item.className = 'q-item';
        item.innerHTML = `
          <div class="q-item-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="quiz-card-id mono">#${q.id}</span>
              <span class="badge badge-category">${q.category || 'General'}</span>
              <span class="badge ${q.difficultyLevel === 'Easy' ? 'badge-easy' : q.difficultyLevel === 'Hard' ? 'badge-hard' : 'badge-medium'}">
                ${q.difficultyLevel || 'Medium'}
              </span>
            </div>
          </div>
          <div class="q-item-title">${q.questionTitle}</div>
          <div class="q-options-preview">
            <div class="q-opt-pill ${q.option1 === q.rightAnswer ? 'correct' : ''}">A: ${q.option1}</div>
            <div class="q-opt-pill ${q.option2 === q.rightAnswer ? 'correct' : ''}">B: ${q.option2}</div>
            <div class="q-opt-pill ${q.option3 === q.rightAnswer ? 'correct' : ''}">C: ${q.option3}</div>
            <div class="q-opt-pill ${q.option4 === q.rightAnswer ? 'correct' : ''}">D: ${q.option4}</div>
          </div>
        `;
        container.appendChild(item);
      });
    }

    searchInput.oninput = applyFilter;
    catSelect.onchange = applyFilter;
    applyFilter();

  } catch (err) {
    container.innerHTML = `
      <div style="padding: 2rem; color: var(--color-danger); text-align: center;">
        Failed to load question repository: ${err.message}
      </div>
    `;
  }
}

// Add New Question Modal Handlers
function initAddQuestionModal() {
  const modal = document.getElementById('modal-add-question');
  const openBtn = document.getElementById('btn-open-add-question');
  const closeBtn = document.getElementById('btn-close-modal-add');
  const cancelBtn = document.getElementById('btn-cancel-add-q');
  const form = document.getElementById('form-add-question');

  if (openBtn) {
    openBtn.onclick = () => {
      audio.play('click');
      form.reset();
      modal.classList.add('active');
    };
  }

  const closeModal = () => modal.classList.remove('active');
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      audio.play('click');

      const title = document.getElementById('add-q-title').value.trim();
      const category = document.getElementById('add-q-category').value.trim();
      const difficultyLevel = document.getElementById('add-q-difficulty').value;
      const opt1 = document.getElementById('add-q-opt1').value.trim();
      const opt2 = document.getElementById('add-q-opt2').value.trim();
      const opt3 = document.getElementById('add-q-opt3').value.trim();
      const opt4 = document.getElementById('add-q-opt4').value.trim();

      const selectedChoice = document.querySelector('input[name="add-q-correct-choice"]:checked').value;
      const rightAnswer = selectedChoice === '1' ? opt1 : selectedChoice === '2' ? opt2 : selectedChoice === '3' ? opt3 : opt4;

      const payload = {
        questionTitle: title,
        option1: opt1,
        option2: opt2,
        option3: opt3,
        option4: opt4,
        rightAnswer,
        difficultyLevel,
        category
      };

      try {
        await api.addQuestion(payload);
        showToast('Question saved successfully to database!', 'success');
        closeModal();
        renderQuestionsView();
      } catch (err) {
        showToast(`Failed to add question: ${err.message}`, 'error');
      }
    };
  }
}

// ============================================================================
// CREATE QUIZ VIEW & GENERATOR
// ============================================================================
async function populateCreateQuizCategories() {
  const catSelect = document.getElementById('create-quiz-category');
  if (!catSelect) return;

  try {
    const questions = await api.getAllQuestions();
    const categories = Array.from(new Set(questions.map(q => q.category).filter(Boolean)));
    
    if (categories.length === 0) {
      catSelect.innerHTML = '<option value="" disabled selected>No categories found in database</option>';
      return;
    }

    catSelect.innerHTML = '<option value="" disabled selected>Select database category...</option>';
    categories.forEach(cat => {
      catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  } catch (e) {
    catSelect.innerHTML = '<option value="" disabled selected>Could not load categories from database</option>';
  }
}

function initCreateQuizForm() {
  const form = document.getElementById('form-create-quiz');
  const cancelBtn = document.getElementById('btn-cancel-create-quiz');

  if (cancelBtn) {
    cancelBtn.onclick = () => switchView('quizzes');
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      audio.play('click');

      const title = document.getElementById('create-quiz-title').value.trim();
      const category = document.getElementById('create-quiz-category').value;
      const numQ = parseInt(document.getElementById('create-quiz-num').value, 10);

      const submitBtn = document.getElementById('btn-submit-create-quiz');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner"></div> Generating...';

      try {
        await api.createQuiz(category, numQ, title);

        const currentQuizzes = getDatabaseQuizzes();
        const maxId = currentQuizzes.reduce((max, q) => Math.max(max, Number(q.id) || 0), 1);
        const nextId = maxId + 1;

        saveDatabaseQuiz({
          id: nextId,
          title: title,
          category: category,
          questionCount: numQ
        });

        showToast(`Quiz #${nextId} "${title}" created successfully in database!`, 'success');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        form.reset();
        switchView('quizzes');
      } catch (err) {
        showToast(`Failed to generate quiz: ${err.message}`, 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    };
  }
}

// ============================================================================
// LIGHTWEIGHT CELEBRATION CONFETTI
// ============================================================================
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 16,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10
    });
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let activeCount = 0;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // gravity
      p.alpha -= 0.012;
      p.rotation += p.vRot;

      if (p.alpha > 0) {
        activeCount++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (activeCount > 0) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  requestAnimationFrame(frame);
}

// ============================================================================
// SETTINGS & MODALS INIT
// ============================================================================
function initSettingsModal() {
  const modal = document.getElementById('modal-settings');
  const openBtn = document.getElementById('btn-open-settings');
  const closeBtn = document.getElementById('btn-close-modal-settings');
  const saveBtn = document.getElementById('btn-save-settings');
  const pingBtn = document.getElementById('btn-ping-api');
  const inputUrl = document.getElementById('setting-api-url');
  const checkSound = document.getElementById('setting-sound-enabled');

  if (openBtn) {
    openBtn.onclick = () => {
      audio.play('click');
      inputUrl.value = state.api.baseUrl;
      checkSound.checked = state.api.soundEnabled;
      modal.classList.add('active');
    };
  }

  const closeModal = () => modal.classList.remove('active');
  if (closeBtn) closeBtn.onclick = closeModal;

  if (pingBtn) {
    pingBtn.onclick = async () => {
      pingBtn.disabled = true;
      pingBtn.textContent = 'Pinging...';
      state.api.baseUrl = inputUrl.value.trim().replace(/\/$/, '');
      const online = await api.ping();
      pingBtn.disabled = false;
      pingBtn.textContent = 'Ping';
      showToast(online ? 'Backend is reachable and healthy!' : 'Backend is unreachable at ' + state.api.baseUrl, online ? 'success' : 'error');
    };
  }

  if (saveBtn) {
    saveBtn.onclick = () => {
      audio.play('click');
      state.api.baseUrl = inputUrl.value.trim().replace(/\/$/, '');
      state.api.soundEnabled = checkSound.checked;

      localStorage.setItem('quiz_api_url', state.api.baseUrl);
      localStorage.setItem('quiz_sound_enabled', state.api.soundEnabled);
      localStorage.removeItem('quiz_force_demo');

      closeModal();
      showToast('Settings saved successfully', 'success');
      api.ping();
    };
  }
}

// ============================================================================
// KEYBOARD SHORTCUTS & APP INITIALIZATION
// ============================================================================
function setupKeyboardNavigation() {
  window.addEventListener('keydown', (e) => {
    // Only handle hotkeys during active quiz player
    if (state.activeView !== 'quiz-player') return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    const qIndex = state.activeQuiz.currentIndex;
    const currentQ = state.activeQuiz.questions[qIndex];
    if (!currentQ) return;

    // Keys 1-4 or A-D to select options
    if (e.key === '1' || e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectOption(qIndex, currentQ.option1);
    } else if (e.key === '2' || e.key.toLowerCase() === 'b') {
      e.preventDefault();
      selectOption(qIndex, currentQ.option2);
    } else if (e.key === '3' || e.key.toLowerCase() === 'c') {
      e.preventDefault();
      selectOption(qIndex, currentQ.option3);
    } else if (e.key === '4' || e.key.toLowerCase() === 'd') {
      e.preventDefault();
      selectOption(qIndex, currentQ.option4);
    } else if (e.key === 'ArrowRight') {
      // Next
      const nextBtn = document.getElementById('btn-quiz-next');
      if (nextBtn) nextBtn.click();
    } else if (e.key === 'ArrowLeft') {
      // Prev
      const prevBtn = document.getElementById('btn-quiz-prev');
      if (prevBtn && !prevBtn.disabled) prevBtn.click();
    } else if (e.key.toLowerCase() === 'f') {
      // Flag
      const flagBtn = document.getElementById('btn-quiz-flag');
      if (flagBtn) flagBtn.click();
    }
  });
}

// Attach all button and UI event bindings
function initEventBindings() {
  // Brand logo click
  document.getElementById('brand-logo').onclick = () => switchView('quizzes');

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.onclick = () => {
      audio.play('click');
      switchView(tab.dataset.view);
    };
  });

  // Reconnect button in demo banner
  const reconnectBtn = document.getElementById('btn-reconnect-api');
  if (reconnectBtn) {
    reconnectBtn.onclick = () => {
      audio.play('click');
      api.ping().then(online => {
        showToast(online ? 'Connected to live Spring Boot backend!' : 'Backend still offline.', online ? 'success' : 'error');
      });
    };
  }

  // Status pill click opens settings
  const statusPill = document.getElementById('api-status-badge');
  if (statusPill) {
    statusPill.onclick = () => document.getElementById('btn-open-settings').click();
  }

  // Quick Play Form in Hero
  const quickForm = document.getElementById('form-quick-play');
  if (quickForm) {
    quickForm.onsubmit = (e) => {
      e.preventDefault();
      const id = document.getElementById('quick-quiz-id').value;
      if (id) {
        audio.play('click');
        startQuizSession(id);
      }
    };
  }

  // Hero "Create New Quiz" button
  const heroCreateBtn = document.getElementById('btn-hero-create-quiz');
  if (heroCreateBtn) {
    heroCreateBtn.onclick = () => switchView('create-quiz');
  }

  // Refresh quizzes button
  const refreshQuizzesBtn = document.getElementById('btn-refresh-quizzes');
  if (refreshQuizzesBtn) {
    refreshQuizzesBtn.onclick = () => {
      audio.play('click');
      renderQuizzesView();
      showToast('Refreshed available quizzes', 'info', 1500);
    };
  }

  // Quiz Player Navigation Buttons
  document.getElementById('btn-quiz-prev').onclick = () => {
    if (state.activeQuiz.currentIndex > 0) {
      audio.play('click');
      state.activeQuiz.currentIndex--;
      renderPalette();
      renderCurrentQuestion();
    }
  };

  document.getElementById('btn-quiz-next').onclick = () => {
    const total = state.activeQuiz.questions.length;
    if (state.activeQuiz.currentIndex < total - 1) {
      audio.play('click');
      state.activeQuiz.currentIndex++;
      renderPalette();
      renderCurrentQuestion();
    } else {
      // Final question -> Confirm submission
      audio.play('click');
      promptSubmitConfirmation();
    }
  };

  document.getElementById('btn-quiz-flag').onclick = () => {
    audio.play('click');
    const idx = state.activeQuiz.currentIndex;
    if (state.activeQuiz.flagged.has(idx)) {
      state.activeQuiz.flagged.delete(idx);
    } else {
      state.activeQuiz.flagged.add(idx);
    }
    renderPalette();
    renderCurrentQuestion();
  };

  document.getElementById('btn-quiz-clear').onclick = () => {
    clearOption(state.activeQuiz.currentIndex);
  };

  document.getElementById('btn-quiz-submit').onclick = () => {
    audio.play('click');
    promptSubmitConfirmation();
  };

  // Submit Modal Actions
  const cancelSubmitBtn = document.getElementById('btn-cancel-final-submit');
  const closeSubmitBtn = document.getElementById('btn-close-modal-confirm');
  const confirmSubmitBtn = document.getElementById('btn-confirm-final-submit');

  const closeConfirmModal = () => document.getElementById('modal-confirm-submit').classList.remove('active');
  if (cancelSubmitBtn) cancelSubmitBtn.onclick = closeConfirmModal;
  if (closeSubmitBtn) closeSubmitBtn.onclick = closeConfirmModal;

  if (confirmSubmitBtn) {
    confirmSubmitBtn.onclick = () => {
      audio.play('click');
      finalizeSubmission();
    };
  }

  // Result Screen Actions
  document.getElementById('btn-result-hub').onclick = () => switchView('quizzes');
  document.getElementById('btn-result-retake').onclick = () => {
    audio.play('click');
    if (state.activeQuiz.isPractice) {
      startPracticeSession(state.activeQuiz.title.split(' ')[0]);
    } else {
      startQuizSession(state.activeQuiz.id, state.activeQuiz.title);
    }
  };

  document.getElementById('btn-result-review').onclick = () => {
    audio.play('click');
    const drawer = document.getElementById('result-review-drawer');
    drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
    if (drawer.style.display === 'block') {
      drawer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Initialize modular modal handlers
  initAddQuestionModal();
  initCreateQuizForm();
  initSettingsModal();
  setupKeyboardNavigation();
}

// App Boot
document.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem('quiz_force_demo');
  initEventBindings();
  switchView('quizzes');
  api.ping();

  // Periodic health check every 15 seconds
  setInterval(() => {
    api.ping();
  }, 15000);
});
