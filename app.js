/* ============================================================
   SERENITY — POMODORO APP
   app.js — All application logic
   ============================================================ */

'use strict';

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Your future self is watching you right now through your memories.", author: "Aubrey de Grey" },
  { text: "Small progress is still progress.", author: "Unknown" },
  { text: "The present moment is the only moment available to us.", author: "Thích Nhất Hạnh" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
];

let settings = {
  focus:    25,
  short:    5,
  long:     15,
  sessions: 4,
  autoBreak: false,
  sound:    true,
};

let state = {
  mode:         'focus',    // 'focus' | 'short' | 'long'
  running:      false,
  timeLeft:     0,
  totalSeconds: 0,
  interval:     null,
  sessionCount: 0,          // completed focus sessions this cycle
  pomodorosToday: 0,
  totalFocusMinutes: 0,
  tasksDone:    0,
  dayStreak:    1,
  activateTaskId: null,
  weekData:     [0, 0, 0, 0, 0, 0, 0],
};

let tasks = [];
let nextTaskId = 1;

const CIRCUMFERENCE = 653.45; // 2π × 104

// ──────────────────────────────────────────────
// Persistence
// ──────────────────────────────────────────────
function saveAll() {
  try {
    localStorage.setItem('serenity_settings', JSON.stringify(settings));
    const saveState = {
      pomodorosToday:    state.pomodorosToday,
      totalFocusMinutes: state.totalFocusMinutes,
      tasksDone:         state.tasksDone,
      dayStreak:         state.dayStreak,
      weekData:          state.weekData,
      sessionCount:      state.sessionCount,
      lastDate:          new Date().toDateString(),
    };
    localStorage.setItem('serenity_state', JSON.stringify(saveState));
    localStorage.setItem('serenity_tasks', JSON.stringify({ tasks, nextTaskId }));
  } catch(e) {}
}

function loadAll() {
  try {
    const s = localStorage.getItem('serenity_settings');
    if (s) Object.assign(settings, JSON.parse(s));

    const st = localStorage.getItem('serenity_state');
    if (st) {
      const saved = JSON.parse(st);
      // Reset daily stats if it's a new day
      const today = new Date().toDateString();
      if (saved.lastDate !== today) {
        // New day — rotate week data
        const todayIdx = new Date().getDay(); // 0=Sun
        saved.weekData = saved.weekData || [0,0,0,0,0,0,0];
        saved.weekData[todayIdx] = 0;
        saved.pomodorosToday = 0;
        saved.dayStreak = (saved.pomodorosToday > 0) ? (saved.dayStreak + 1) : 1;
      }
      state.pomodorosToday    = saved.pomodorosToday    || 0;
      state.totalFocusMinutes = saved.totalFocusMinutes || 0;
      state.tasksDone         = saved.tasksDone         || 0;
      state.dayStreak         = saved.dayStreak         || 1;
      state.weekData          = saved.weekData          || [0,0,0,0,0,0,0];
      state.sessionCount      = saved.sessionCount      || 0;
    }

    const tk = localStorage.getItem('serenity_tasks');
    if (tk) {
      const data = JSON.parse(tk);
      tasks     = data.tasks     || [];
      nextTaskId = data.nextTaskId || 1;
    }
  } catch(e) {}
}

// ──────────────────────────────────────────────
// Timer Logic
// ──────────────────────────────────────────────
function getDuration(mode) {
  if (mode === 'focus') return settings.focus * 60;
  if (mode === 'short') return settings.short * 60;
  return settings.long * 60;
}

function setMode(mode, autoStart = false) {
  if (state.running) stopTimer();
  state.mode = mode;

  // update tabs
  ['focus','short','long'].forEach(m => {
    document.getElementById(`tab-${m}`).classList.toggle('active', m === mode);
  });

  // update body class for color theme
  document.body.className = mode === 'focus' ? '' : `mode-${mode}`;

  // update label
  const labels = { focus: 'Time to focus', short: 'Short break', long: 'Long break' };
  document.getElementById('timer-label').textContent = labels[mode];

  resetTimer();
  if (autoStart) startTimer();
}

function resetTimer() {
  stopTimer();
  state.timeLeft = getDuration(state.mode);
  state.totalSeconds = state.timeLeft;
  renderTimer();
}

function toggleTimer() {
  state.running ? stopTimer() : startTimer();
}

function startTimer() {
  if (state.timeLeft <= 0) resetTimer();
  state.running = true;
  state.totalSeconds = state.totalSeconds || getDuration(state.mode);
  updatePlayPauseIcon();
  state.interval = setInterval(tick, 1000);
  // Animate card glow
  document.querySelector('.timer-card').style.boxShadow = `0 8px 40px var(--accent-glow), 0 0 0 1px var(--accent-start)`;
}

function stopTimer() {
  clearInterval(state.interval);
  state.running = false;
  updatePlayPauseIcon();
  document.querySelector('.timer-card').style.boxShadow = '';
}

function tick() {
  state.timeLeft--;
  renderTimer();
  if (state.timeLeft <= 0) {
    onTimerComplete();
  }
}

function onTimerComplete() {
  stopTimer();
  playSound();

  if (state.mode === 'focus') {
    state.pomodorosToday++;
    state.totalFocusMinutes += settings.focus;
    state.sessionCount++;
    updateWeekData();
    updateDots();
    updateStats();
    saveAll();

    if (state.sessionCount >= settings.sessions) {
      state.sessionCount = 0;
      showToast('🎉 Great work! Take a long break!');
      if (settings.autoBreak) setMode('long', true);
      else setMode('long');
    } else {
      showToast('✅ Pomodoro done! Take a short break.');
      if (settings.autoBreak) setMode('short', true);
      else setMode('short');
    }
  } else {
    showToast('🍅 Break over. Back to focus!');
    if (settings.autoBreak) setMode('focus', true);
    else setMode('focus');
  }
}

function skipSession() {
  onTimerComplete();
}

function renderTimer() {
  const m = String(Math.floor(state.timeLeft / 60)).padStart(2, '0');
  const s = String(state.timeLeft % 60).padStart(2, '0');
  document.getElementById('timer-display').textContent = `${m}:${s}`;

  // Ring progress
  const total = getDuration(state.mode);
  const ratio = state.timeLeft / total;
  const offset = CIRCUMFERENCE * (1 - ratio);
  document.getElementById('ring-progress').style.strokeDashoffset = offset;

  // Page title
  document.title = `${m}:${s} — Serenity`;
}

function updatePlayPauseIcon() {
  document.getElementById('play-icon').style.display  = state.running ? 'none' : 'block';
  document.getElementById('pause-icon').style.display = state.running ? 'block' : 'none';
}

function updateDots() {
  const total = settings.sessions;
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    const filled = (state.sessionCount % total) >= i || (state.sessionCount % total === 0 && state.sessionCount > 0);
    dot.classList.toggle('filled', i <= (state.sessionCount % total) || (state.sessionCount >= total && i <= total));
  }
  // simpler — just fill dots based on session count in current cycle
  const inCycle = state.sessionCount % settings.sessions;
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) dot.classList.toggle('filled', i <= inCycle);
  }
}

function updateWeekData() {
  const dayIdx = new Date().getDay();
  state.weekData[dayIdx] = (state.weekData[dayIdx] || 0) + 1;
}

// ──────────────────────────────────────────────
// Tasks
// ──────────────────────────────────────────────
function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;

  const task = { id: nextTaskId++, text, done: false, pomodoros: 0 };
  tasks.push(task);
  input.value = '';
  renderTasks();
  saveAll();
}

function handleTaskInput(e) {
  if (e.key === 'Enter') addTask();
}

function toggleTaskDone(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  if (task.done) {
    state.tasksDone++;
    updateStats();
  } else {
    state.tasksDone = Math.max(0, state.tasksDone - 1);
    updateStats();
  }
  renderTasks();
  saveAll();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  if (state.activateTaskId === id) {
    state.activateTaskId = null;
    setActiveTask(null);
  }
  renderTasks();
  saveAll();
}

function selectActiveTask(id) {
  state.activateTaskId = (state.activateTaskId === id) ? null : id;
  const task = tasks.find(t => t.id === id);
  setActiveTask(task || null);
  renderTasks();
}

function setActiveTask(task) {
  const nameEl = document.getElementById('active-task-name');
  if (task) {
    nameEl.textContent = task.text;
    nameEl.classList.add('has-task');
  } else {
    nameEl.textContent = 'No task selected';
    nameEl.classList.remove('has-task');
  }
}

function renderTasks() {
  const list = document.getElementById('task-list');
  const empty = document.getElementById('tasks-empty');
  const count = document.getElementById('task-count');

  list.innerHTML = '';

  if (tasks.length === 0) {
    empty.classList.add('visible');
    count.textContent = '0 tasks';
    return;
  }
  empty.classList.remove('visible');
  count.textContent = `${tasks.filter(t => !t.done).length} remaining`;

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item${task.done ? ' done' : ''}${state.activateTaskId === task.id ? ' active-focus' : ''}`;
    li.innerHTML = `
      <div class="task-check" onclick="toggleTaskDone(${task.id})">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="2 6 5 9 10 3"/>
        </svg>
      </div>
      <span class="task-text" onclick="selectActiveTask(${task.id})">${escHtml(task.text)}</span>
      <span class="task-pomodoros" title="Pomodoros spent">🍅 ${task.pomodoros}</span>
      <button class="task-delete" onclick="deleteTask(${task.id})" title="Delete task">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;
    list.appendChild(li);
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ──────────────────────────────────────────────
// Stats
// ──────────────────────────────────────────────
function updateStats() {
  document.getElementById('stat-today').textContent  = state.pomodorosToday;
  const hours = Math.floor(state.totalFocusMinutes / 60);
  const mins  = state.totalFocusMinutes % 60;
  document.getElementById('stat-total-time').textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  document.getElementById('stat-tasks-done').textContent = state.tasksDone;
  document.getElementById('stat-streak').textContent     = state.dayStreak;
  renderBarChart();
}

function renderBarChart() {
  const chart  = document.getElementById('bar-chart');
  const labels = document.getElementById('chart-labels');
  chart.innerHTML  = '';
  labels.innerHTML = '';

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date().getDay();
  const maxVal = Math.max(...state.weekData, 1);

  for (let i = 0; i < 7; i++) {
    const val = state.weekData[i] || 0;
    const heightPct = (val / maxVal) * 100;
    const isToday = i === today;

    const wrap = document.createElement('div');
    wrap.className = 'bar-wrap';

    const barEl = document.createElement('div');
    barEl.className = `bar${isToday ? ' today' : ''}`;
    barEl.style.height = `${Math.max(heightPct, val > 0 ? 8 : 0)}%`;
    barEl.title = `${val} pomodoro${val !== 1 ? 's' : ''}`;

    const valEl = document.createElement('div');
    valEl.className = 'bar-val';
    valEl.textContent = val || '';

    wrap.appendChild(barEl);
    wrap.appendChild(valEl);
    chart.appendChild(wrap);

    const lbl = document.createElement('div');
    lbl.className = `chart-label${isToday ? ' today' : ''}`;
    lbl.textContent = days[i];
    labels.appendChild(lbl);
  }
}

// ──────────────────────────────────────────────
// Settings
// ──────────────────────────────────────────────
function toggleSettings() {
  const panel   = document.getElementById('settings-panel');
  const overlay = document.getElementById('settings-overlay');
  const isOpen  = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
}

function changeSetting(key, delta) {
  const minVal = { focus: 5, short: 1, long: 5, sessions: 2 };
  const maxVal = { focus: 90, short: 30, long: 60, sessions: 8 };
  settings[key] = Math.min(maxVal[key], Math.max(minVal[key], settings[key] + delta));
  document.getElementById(`set-${key}`).textContent = settings[key];
  if (!state.running) resetTimer();
  saveAll();
}

function saveSetting() {
  settings.autoBreak = document.getElementById('set-auto-break').checked;
  settings.sound     = document.getElementById('set-sound').checked;
  saveAll();
}

function loadSettingsUI() {
  document.getElementById('set-focus').textContent          = settings.focus;
  document.getElementById('set-short').textContent          = settings.short;
  document.getElementById('set-long').textContent           = settings.long;
  document.getElementById('set-sessions').textContent       = settings.sessions;
  document.getElementById('set-auto-break').checked         = settings.autoBreak;
  document.getElementById('set-sound').checked              = settings.sound;
}

// ──────────────────────────────────────────────
// Navigation
// ──────────────────────────────────────────────
function showSection(name) {
  ['timer','tasks','stats'].forEach(s => {
    document.getElementById(`section-${s}`).classList.toggle('active', s === name);
    document.getElementById(`nav-${s}`).classList.toggle('active', s === name);
  });
  if (name === 'stats') updateStats();
  if (name === 'tasks') renderTasks();
}

// ──────────────────────────────────────────────
// Sound (Web Audio API)
// ──────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound() {
  if (!settings.sound) return;
  try {
    const ctx = getAudioCtx();
    // Soft bell chord
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      osc.start(t);
      osc.stop(t + 1.6);
    });
  } catch(e) {}
}

// ──────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ──────────────────────────────────────────────
// Quotes
// ──────────────────────────────────────────────
function setRandomQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById('quote-text').textContent   = `"${q.text}"`;
  document.getElementById('quote-author').textContent = `— ${q.author}`;
}

// Rotate quotes every 5 minutes
setInterval(() => {
  if (document.getElementById('section-timer').classList.contains('active')) {
    setRandomQuote();
  }
}, 5 * 60 * 1000);

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
function init() {
  loadAll();
  loadSettingsUI();
  resetTimer();
  renderTasks();
  updateStats();
  setRandomQuote();

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Space = play/pause (when not focused on input)
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      toggleTimer();
    }
    // R = reset
    if (e.code === 'KeyR' && e.target.tagName !== 'INPUT') {
      resetTimer();
    }
    // Escape = close settings
    if (e.code === 'Escape') {
      const panel = document.getElementById('settings-panel');
      if (panel.classList.contains('open')) toggleSettings();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
