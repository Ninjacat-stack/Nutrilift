# Nutrilift — Training & Stack Log

> **Logged, not guessed.** A clean, premium training + supplement log for the 5am crew.

Nutrilift is a fast, local-first web app to log lifts, track supplement adherence, and keep the streak alive. No backend, no bloat — just a focused dashboard that feels like a modern product site: minimal, aesthetic, premium, with subtle 3D accents and a cinematic Showcase tour.

Live pages: `index.html` → Dashboard · `programs.html` → Program Library · `history.html` → 90-Day History · `showcase.html` → Cinematic Tour · `404.html` → Not found

---

## ✨ Features

### Dashboard (`index.html`)
- **Today's Session** — Push / Pull / Legs switcher (tap the session tag), editable exercise rows (click text to edit), add/delete exercises, check off sets. Barbell visual loads as you check off; progress shows `done/total + %`. Persists per day.
- **Today's Stack** — Editable supplement list (add/delete/rename), one-tap pop buttons, live adherence %.
- **This Week** — 7-day volume chart (plate stacks) computed from real logs + live week summary.
- **Fuel Today** — Protein / Carbs / Fats / Calories bars with targets (165P · 240C · 70F · 2200kcal), _Add Meal_ form with presets (Whey / Meal / Snack), auto kcal estimate, over-target glow. Saved per day.
- **Body Weight** — One weigh-in per day (kg) from the dashboard: Current / 7-day Δ / 30-day Δ stats plus a 30-day SVG trend chart (area fill, per-point tooltips, today highlighted). Kept for 365 days, shown in day details and CSV export.
- **Personal Records** — Editable PR table (add/delete), persisted; latest PR feeds the hero badge.
- **Hero** — Live stats (logs this month, adherence, PRs tracked), last-6-days volume bars, live session label + stack preview. No fake numbers — everything renders from storage.
- **Insights** — Longest streak, volume delta, 90-day adherence, all computed live.
- **Programs teaser** (3 cards), **Pricing** (Starter / Pro ₹199 / Squad ₹499), **FAQ** (accordion), **External resources** (curated outbound links), **CTA**, footer with newsletter (validated, stored locally).

### Program Library (`programs.html`)
- 6 proven splits: Full-Body Foundation (3D), Upper/Lower Power (4D), PPL Pro (5D), Bro Split 2.0 (4D), High Frequency (6D), Comp Peaking (5-6D).
- Filter by `All / 3 Day / 4 Day / 5 Day / 6 Day / Strength / Hypertrophy`.
- Detail modal with day-by-day focus + _Set as active program_ (saved to `localStorage` `activeProgram`).
- Live _Active Program_ card (sessions logged + real adherence %).

### 90-Day History (`history.html`)
- Streak calendar (90 cells: empty / partial / done + today ring) — click any day for detail (lifts, stack, fuel, weight).
- Recent logs (last 14), breakdown (lifts, stack, avg kcal, best streak).
- Export CSV (`date,lifts_done,stack_done,protein,carbs,fats,kcal,weight_kg`) + clear history.

### Showcase (`showcase.html` + `showcase-3d.js`)
- Apple-style scroll story in red + black: full-screen hero (scramble title, parallax), sticky pinned 3D plate reacting to scroll (Three.js WebGL with CSS-3D fallback), choc-chip phase label, chapter cards, kinetic marquee, live spec counters, feature grid from `SHOWCASE_DATA`, final CTA.
- Performance: capped DPR, half-res bloom on strong desktops only, particle budgets, pause offscreen/hidden, `prefers-reduced-motion` + mobile fallbacks.
- Light mode fully supported (paper theme, same story).

### Fun (desktop, fine pointer only)
- **Directional bow cursor** — follows the mouse, aims opposite your movement. **Double-click** shoots an arrow (button snipe when no target); **triple-click** spawns an archery board on the predicted flight path — hit it or get benched to the `404.html?missed=1` loser screen. Hits counted in storage.
- **Beast mode** — type `BEAST` or the Konami code for a red-glow theme; persists.

### System
- **Theme** — Light/Dark toggle (masthead), persisted, respects `prefers-color-scheme`, no-flash inline bootstrap.
- **Header** — Floating sticky, shrinks on scroll (`is-scrolled`), backdrop blur, mobile nav.
- **Storage** — `nutrilift:v1` { `theme`, `session`, `exercises[]`, `stackDefs[]`, `prs[]`, `bodyweight: { YYYY-MM-DD: kg }`, `activeProgram`, `emails[]`, `archeryHits`, `beast`, `days: { YYYY-MM-DD: {lifts:[bool], stack:[bool], fuel:{}} }` } — `days` pruned to 90 days, `bodyweight` kept 365 days.
- **Toast** — Minimal premium toast (`#toastStack`) with `aria-live`.
- **Shortcuts** — `t` theme, `?` help, `Esc` closes modal.
- **Accessibility** — Skip links, `aria-pressed`/`aria-invalid`, visible focus rings, keyboard-operable controls, `prefers-reduced-motion` respected.

---

## 🎨 Design Philosophy

> **Clean UI first → Usability second → Aesthetic details third → Subtle 3D last.**

- Single static orb (`--iron-red-glow`), faint grid, one hero wash. Only featured cards use `subtle-tilt` (1.6° max, no shadow follow). Reveal is `fade + 10px rise` (0.45s).
- Spacing, typography (`Oswald` display, `Inter` body, `IBM Plex Mono` accent), and soft shadows (`--shadow-sm/md/lg`) do the heavy lifting. Showcase is the one place that goes full cinematic.

**Tokens** (`style.css:4`):
```css
--paper: #FAF6F1; --surface: #FFFFFF; --ink: #211714;
--iron-red: #C81E3D; --iron-red-glow: rgba(200,30,61,0.10);
--brick: #8F2438; --shadow-sm/md/lg; --radius: 8px / 16px;
```
Dark theme inverts `paper/surface/ink/line` and lifts shadows.

---

## 🧱 Tech Stack

- **No build step** — vanilla HTML/CSS/JS, no framework.
- **Fonts:** Google Fonts (Oswald, Inter, IBM Plex Mono).
- **Icons:** Unicode + CSS (no icon font).
- **Storage:** `localStorage` only. No API/backend/auth.
- **3D:** Three.js 0.160 via CDN importmap, showcase page only, lazy with CSS fallback.

---

## 📁 Structure

```
Nutrilift/
├── index.html      # Dashboard + marketing sections
├── programs.html   # Program library + filters + modal
├── history.html    # 90-day calendar + export
├── showcase.html   # Cinematic red + black tour
├── 404.html        # Not found (+ archery loser mode)
├── style.css       # Tokens, layout, components, showcase (~1248 lines)
├── script.js       # State, dashboard CRUD, history, programs, showcase UI (~1165 lines)
├── showcase-3d.js  # WebGL scene + showcase FX (~306 lines)
└── README.md
```

Key entry points in code:
- Storage & streak: `script.js:61` `getTodayState`, `script.js:78` `computeStreak`
- Lifts: `script.js:353` `initEditableLog`, `script.js:190` `initBarbellProgress`
- Fuel: `script.js:410` `initFuel`
- Body weight: `script.js:568` `initBodyWeight` (+ `renderWeightChart` / `renderWeightStats`)
- Reveal / tilt: `script.js:592` `initReveal`, `script.js:610` `initTilt3D`
- Bow + beast: `script.js:653` `initBowShoot`, `script.js:769` `initBeastMode`
- History: `script.js:887` `initHistoryPage`
- Showcase UI: `script.js:934` `initShowcase` (`SHOWCASE_DATA` single source of truth)
- Programs: `script.js:1088` `initProgramsPage`
- Styles: `style.css:4` tokens, masthead/hero/dashboard components, `SHOWCASE` section at the end

---

## 🚀 Getting Started

### Open locally
```bash
# just open — no install
start index.html        # Windows
open index.html         # macOS
# or serve to avoid file:// quirks (recommended — showcase uses ES modules)
npx serve .             # then http://localhost:3000
python -m http.server 8000
```

> Note: `showcase.html` loads `showcase-3d.js` as an ES module + Three.js from CDN, so it needs `http(s)` + internet. Everything else works from `file://` offline.

### Use
1. Check off lifts in **Today's Session** — barbell loads, progress `%` updates, streak ticks.
2. Tap the session tag to cycle **Push → Pull → Legs**.
3. Pop supplements in **Today's Stack** — adherence updates everywhere.
4. **Fuel** → _Add Meal_ (try a preset) — bars + history update.
5. **Body Weight** → log today's kg — stats, trend chart and deltas update.
6. **Programs** → filter → _View details_ → _Set as active_.
7. **History** → click days, export CSV.
8. **Showcase** → scroll the story, click the canvas for shockwaves.
9. Desktop extras: double-click to shoot, triple-click for archery, type `BEAST`.

### Reset data
In browser console:
```js
localStorage.removeItem('nutrilift:v1'); location.reload();
```

---

## ♿ Accessibility & Performance

- `prefers-reduced-motion` disables reveal/tilt/WebGL/bow/beast animations.
- Keyboard: `Tab` through nav, `Space/Enter` on toggles, `Esc` closes modal, `t`/`?` shortcuts.
- `transform` + `opacity` only for animations; `requestAnimationFrame` batching; `content-visibility` on below-fold sections.
- Responsive: `1180px` max, grids collapse at `960/860/640/520px`, masthead collapses to mobile nav, tables scroll horizontally on small screens.

---

## 🗺️ Roadmap Ideas

- PR auto-detect on new best, streak freeze, PWA `manifest` + offline, CSV import, measurement tracking (waist, arms).

---

## 📄 License

No license specified — treat as personal project. Replace pricing copy before commercial use.

Built for lifters, not influencers. **Squat · Bench · Deadlift · Rinse · Repeat.**
