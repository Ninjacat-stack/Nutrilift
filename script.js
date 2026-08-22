const STORAGE_KEY = "nutrilift:v1";
const DAYS_TO_KEEP = 90;

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDateBadge() {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
}

function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function pruneOldDays(data) {
  if (!data.days) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  Object.keys(data.days).forEach(k => {
    if (k < cutoffKey) delete data.days[k];
  });
}

function getTodayState(data) {
  const key = todayKey();
  if (data.days && data.days[key]) return data.days[key];
  return null;
}

function setTodayState(data, lifts, stack) {
  const key = todayKey();
  if (!data.days) data.days = {};
  data.days[key] = { lifts, stack };
  pruneOldDays(data);
  saveStorage(data);
}

function computeStreak(data) {
  if (!data.days) return 0;
  const today = todayKey();
  let streak = 0;
  let cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const key = `${cursor.getFullYear()}-${m}-${d}`;
    const dayData = data.days[key];
    const active = dayData && (dayData.lifts?.some(v => v) || dayData.stack?.some(v => v));
    if (key === today && !active) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (active) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function applyTheme(theme) {
  const html = document.documentElement;
  const toggle = document.getElementById("themeToggle");
  html.setAttribute("data-theme", theme);
  if (toggle) {
    const isDark = theme === "dark";
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.querySelector(".switch-label").textContent = isDark ? "LIGHT" : "DARK";
    toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }
  const data = loadStorage();
  data.theme = theme;
  saveStorage(data);
}

function initThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  const data = loadStorage();
  const initialTheme = data.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(initialTheme);

  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

function initHeaderShrink() {
  const header = document.querySelector(".masthead");
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 16);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initDateAndStreak() {
  document.getElementById("dateBadge").textContent = formatDateBadge();
  const data = loadStorage();
  const streak = computeStreak(data);
  document.getElementById("streakCount").textContent = streak;
}

function initBarbellProgress() {
  const rows = document.querySelectorAll("#logSheet tbody tr");
  const platesRow = document.getElementById("platesRow");
  const sizes = [22, 19, 16, 14, 12];

  rows.forEach((row, i) => {
    const disc = document.createElement("span");
    disc.className = "plate-disc";
    const size = sizes[i] ?? 12;
    disc.style.width = size + "px";
    disc.style.height = size + "px";
    disc.dataset.index = i;
    platesRow.appendChild(disc);
  });

  updateBarbellProgress();
}

function updateBarbellProgress() {
  const rows = document.querySelectorAll("#logSheet tbody tr");
  const discs = document.querySelectorAll(".plate-disc");
  let doneCount = 0;

  rows.forEach((row, i) => {
    const isDone = row.getAttribute("data-done") === "true";
    if (isDone) doneCount++;
    if (discs[i]) discs[i].classList.toggle("loaded", isDone);
  });

  document.getElementById("doneCount").textContent = doneCount;
  document.getElementById("totalCount").textContent = rows.length;
}

function applyLiftState(lifts) {
  const rows = document.querySelectorAll("#logSheet tbody tr");
  rows.forEach((row, i) => {
    const done = lifts[i] ?? false;
    row.setAttribute("data-done", String(done));
    const btn = row.querySelector(".check-btn");
    if (btn) btn.setAttribute("aria-pressed", String(done));
  });
  updateBarbellProgress();
}

function applyStackState(stack) {
  const cards = document.querySelectorAll(".pill-card");
  cards.forEach((card, i) => {
    const taken = stack[i] ?? false;
    card.setAttribute("data-taken", String(taken));
    const btn = card.querySelector(".pop-btn");
    if (btn) btn.setAttribute("aria-pressed", String(taken));
  });
  updateStackAdherence();
}

function initCheckButtons() {
  document.querySelectorAll("#logSheet tbody").forEach(tbody => {
    tbody.addEventListener("click", e => {
      const btn = e.target.closest(".check-btn");
      if (!btn) return;
      const row = btn.closest("tr");
      const nowDone = row.getAttribute("data-done") !== "true";
      row.setAttribute("data-done", String(nowDone));
      btn.setAttribute("aria-pressed", String(nowDone));
      updateBarbellProgress();
      persistCurrentState();
    });
  });
}

function initStackAdherence() {
  document.querySelectorAll(".pill-list").forEach(list => {
    list.addEventListener("click", e => {
      const btn = e.target.closest(".pop-btn");
      if (!btn) return;
      const card = btn.closest(".pill-card");
      const nowTaken = card.getAttribute("data-taken") !== "true";
      card.setAttribute("data-taken", String(nowTaken));
      btn.setAttribute("aria-pressed", String(nowTaken));
      updateStackAdherence();
      persistCurrentState();
    });
  });
  updateStackAdherence();
}

function updateStackAdherence() {
  const cards = document.querySelectorAll(".pill-card");
  const taken = document.querySelectorAll('.pill-card[data-taken="true"]').length;
  const pct = Math.round((taken / cards.length) * 100);
  document.getElementById("adherencePct").textContent = pct;
}

function persistCurrentState() {
  const data = loadStorage();
  const rows = document.querySelectorAll("#logSheet tbody tr");
  const cards = document.querySelectorAll(".pill-card");

  const lifts = Array.from(rows).map(r => r.getAttribute("data-done") === "true");
  const stack = Array.from(cards).map(c => c.getAttribute("data-taken") === "true");

  setTodayState(data, lifts, stack);
  const streak = computeStreak(data);
  document.getElementById("streakCount").textContent = streak;
}

function loadPersistedState() {
  const data = loadStorage();
  const today = getTodayState(data);
  if (today) {
    if (today.lifts) applyLiftState(today.lifts);
    if (today.stack) applyStackState(today.stack);
  } else {
    updateBarbellProgress();
    updateStackAdherence();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initHeaderShrink();
  initDateAndStreak();
  initBarbellProgress();
  initCheckButtons();
  initStackAdherence();
  loadPersistedState();
});