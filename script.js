
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

