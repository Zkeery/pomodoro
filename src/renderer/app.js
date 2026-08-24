const CIRCUMFERENCE = 2 * Math.PI * 96;
const SET_SIZE = 4;

const els = {
  time: document.getElementById("time"),
  status: document.getElementById("status"),
  ring: document.getElementById("ring"),
  dots: document.getElementById("dots"),
  today: document.getElementById("today-count"),
  toggle: document.getElementById("btn-toggle"),
  reset: document.getElementById("btn-reset"),
  skip: document.getElementById("btn-skip"),
  pin: document.getElementById("btn-pin"),
  settingsBtn: document.getElementById("btn-settings"),
  settings: document.getElementById("settings"),
  closeSettings: document.getElementById("btn-close-settings"),
  work: document.getElementById("input-work"),
  short: document.getElementById("input-short"),
  long: document.getElementById("input-long"),
  sound: document.getElementById("input-sound"),
};

const MODE_META = {
  work: { label: "工作", nextHint: "专注进行中", idle: "准备开始专注" },
  short: { label: "短休息", nextHint: "休息一下", idle: "准备开始短休息" },
  long: { label: "长休息", nextHint: "好好放松", idle: "准备开始长休息" },
};

const state = {
  mode: "work",
  remainingMs: 25 * 60 * 1000,
  durationMs: 25 * 60 * 1000,
  running: false,
  timerId: null,
  endsAt: 0,
  settings: {
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    alwaysOnTop: true,
    soundEnabled: true,
    todayDate: "",
    todayCount: 0,
    completedInSet: 0,
  },
};

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function minutesFor(mode) {
  if (mode === "short") return state.settings.shortBreakMinutes;
  if (mode === "long") return state.settings.longBreakMinutes;
  return state.settings.workMinutes;
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function setAccent(mode) {
  document.body.dataset.mode = mode;
  const color = mode === "short" ? "#4ecdc4" : mode === "long" ? "#7aa2ff" : "#ef5a3c";
  document.documentElement.style.setProperty("--accent", color);
}

function renderDots() {
  els.dots.innerHTML = "";
  for (let i = 0; i < SET_SIZE; i += 1) {
    const node = document.createElement("span");
    node.className = "dot-pomo";
    if (i < state.settings.completedInSet) node.classList.add("done");
    if (state.mode === "work" && i === state.settings.completedInSet) {
      node.classList.add("current");
    }
    els.dots.appendChild(node);
  }
}

function render() {
  els.time.textContent = formatTime(state.remainingMs);
  const progress = 1 - state.remainingMs / state.durationMs;
  els.ring.style.strokeDasharray = String(CIRCUMFERENCE);
  els.ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progress));
  els.today.textContent = String(state.settings.todayCount);
  els.toggle.textContent = state.running ? "暂停" : "开始";
  els.toggle.classList.toggle("running", state.running);
  document.body.classList.toggle("running", state.running);
  els.pin.setAttribute("aria-pressed", String(Boolean(state.settings.alwaysOnTop)));
  els.pin.title = state.settings.alwaysOnTop ? "取消置顶" : "窗口置顶";

  document.querySelectorAll(".mode").forEach((btn) => {
    const active = btn.dataset.mode === state.mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  const meta = MODE_META[state.mode];
  if (state.running) {
    els.status.textContent = meta.nextHint;
  } else if (state.remainingMs < state.durationMs) {
    els.status.textContent = "已暂停";
  } else {
    els.status.textContent = meta.idle;
  }

  renderDots();
}

function persist(patch) {
  Object.assign(state.settings, patch);
  return window.pomodoro.setStore(patch);
}

function applyMode(mode, { keepRunning = false } = {}) {
  state.mode = mode;
  state.durationMs = minutesFor(mode) * 60 * 1000;
  state.remainingMs = state.durationMs;
  setAccent(mode);
  if (keepRunning) {
    state.endsAt = Date.now() + state.remainingMs;
  } else {
    pause();
  }
  render();
}

function tick() {
  state.remainingMs = Math.max(0, state.endsAt - Date.now());
  render();
  if (state.remainingMs <= 0) {
    completeSession();
  }
}

function start() {
  if (state.running) return;
  if (state.remainingMs <= 0) {
    state.remainingMs = state.durationMs;
  }
  state.running = true;
  state.endsAt = Date.now() + state.remainingMs;
  state.timerId = window.setInterval(tick, 250);
  render();
}

function pause() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  if (state.running) {
    state.remainingMs = Math.max(0, state.endsAt - Date.now());
  }
  state.running = false;
  render();
}

function toggle() {
  if (state.running) pause();
  else start();
}

function reset() {
  applyMode(state.mode);
}

function playChime() {
  if (!state.settings.soundEnabled) return;
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.16);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.16 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.45);
    });
    window.setTimeout(() => ctx.close(), 1200);
  } catch {
    // AudioContext may be blocked until a user gesture; ignore.
  }
}

function nextModeAfter(mode, completedWork) {
  if (mode !== "work") return "work";
  return completedWork && state.settings.completedInSet === 0 ? "long" : "short";
}

async function completeSession() {
  pause();
  const finishedWork = state.mode === "work";
  let completedInSet = state.settings.completedInSet;
  let todayCount = state.settings.todayCount;

  if (finishedWork) {
    todayCount += 1;
    completedInSet = (completedInSet + 1) % SET_SIZE;
    await persist({ todayCount, completedInSet, todayDate: todayKey() });
  }

  playChime();
  const next = nextModeAfter(state.mode, finishedWork);
  const title = finishedWork ? "专注完成" : `${MODE_META[state.mode].label}结束`;
  const body = `接下来是${MODE_META[next].label} ${minutesFor(next)} 分钟`;
  window.pomodoro.notify({ title, body });
  applyMode(next);
  els.status.textContent = `${title}，${body}`;
}

function skip() {
  pause();
  const next = nextModeAfter(state.mode, false);
  applyMode(next);
}

function openSettings() {
  els.work.value = String(state.settings.workMinutes);
  els.short.value = String(state.settings.shortBreakMinutes);
  els.long.value = String(state.settings.longBreakMinutes);
  els.sound.checked = Boolean(state.settings.soundEnabled);
  els.settings.hidden = false;
}

async function closeSettings() {
  const workMinutes = clamp(Number(els.work.value) || 25, 1, 180);
  const shortBreakMinutes = clamp(Number(els.short.value) || 5, 1, 60);
  const longBreakMinutes = clamp(Number(els.long.value) || 15, 1, 90);
  const soundEnabled = els.sound.checked;
  await persist({ workMinutes, shortBreakMinutes, longBreakMinutes, soundEnabled });
  els.settings.hidden = true;
  if (!state.running) {
    applyMode(state.mode);
  } else {
    state.durationMs = minutesFor(state.mode) * 60 * 1000;
    render();
  }
}

async function togglePin() {
  const next = !state.settings.alwaysOnTop;
  const applied = await window.pomodoro.setAlwaysOnTop(next);
  state.settings.alwaysOnTop = applied;
  render();
}

function bindEvents() {
  els.toggle.addEventListener("click", toggle);
  els.reset.addEventListener("click", reset);
  els.skip.addEventListener("click", skip);
  els.pin.addEventListener("click", togglePin);
  els.settingsBtn.addEventListener("click", openSettings);
  els.closeSettings.addEventListener("click", closeSettings);
  document.getElementById("btn-close").addEventListener("click", () => window.pomodoro.close());
  document.getElementById("btn-minimize").addEventListener("click", () => window.pomodoro.minimize());

  document.querySelectorAll(".mode").forEach((btn) => {
    btn.addEventListener("click", () => applyMode(btn.dataset.mode));
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input")) return;
    if (event.code === "Space") {
      event.preventDefault();
      toggle();
    } else if (event.key.toLowerCase() === "r") {
      reset();
    } else if (event.key.toLowerCase() === "s") {
      skip();
    } else if (event.key === "Escape" && !els.settings.hidden) {
      closeSettings();
    }
  });
}

async function init() {
  const stored = await window.pomodoro.getStore();
  const today = todayKey();
  if (stored.todayDate !== today) {
    stored.todayDate = today;
    stored.todayCount = 0;
    await window.pomodoro.setStore({ todayDate: today, todayCount: 0 });
  }
  state.settings = { ...state.settings, ...stored };
  setAccent("work");
  applyMode("work");
  bindEvents();
}

init();
