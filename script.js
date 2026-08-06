
document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initBarbellProgress();
  initCheckButtons();
  initStackAdherence();
});

/* ---------- Theme toggle ---------- */
function initThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  const html = document.documentElement;

  toggle.addEventListener("click", () => {
    const isDark = html.getAttribute("data-theme") === "dark";
    html.setAttribute("data-theme", isDark ? "light" : "dark");
    toggle.setAttribute("aria-pressed", String(!isDark));
    toggle.querySelector(".switch-label").textContent = isDark ? "DARK" : "LIGHT";
    toggle.setAttribute("aria-label", isDark ? "Switch to dark mode" : "Switch to light mode");
  });
}

function initBarbellProgress() {
  const rows = document.querySelectorAll("#logSheet tbody tr");
  const platesRow = document.getElementById("platesRow");

  // Plate sizes echo real plate weights: bigger discs first, tapering down.
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

/* ---------- Exercise checkboxes ---------- */
function initCheckButtons() {
  document.querySelectorAll(".check-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      const nowDone = row.getAttribute("data-done") !== "true";
      row.setAttribute("data-done", String(nowDone));
      btn.setAttribute("aria-pressed", String(nowDone));
      updateBarbellProgress();
    });
  });
}

function initStackAdherence() {
  document.querySelectorAll(".pop-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".pill-card");
      const nowTaken = card.getAttribute("data-taken") !== "true";
      card.setAttribute("data-taken", String(nowTaken));
      btn.setAttribute("aria-pressed", String(nowTaken));
      updateStackAdherence();
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

