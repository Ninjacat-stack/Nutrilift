# Nutrilift — Training & Stack Log

> **Logged, not guessed.** A clean, premium training + supplement log for the 5am crew.

Nutrilift is a fast, local-first web app to log lifts, track supplement adherence, and keep the streak alive. No backend, no bloat — just a focused dashboard that feels like a modern product site: minimal, aesthetic, premium, with subtle 3D accents.

Live pages: `index.html` → Dashboard · `programs.html` → Program Library

---

## ✨ Features

### Dashboard (`index.html`)
- **Today's Session** — Push Day starter (5 lifts) with barbell visual that loads as you check off sets. Persists to `localStorage` per day.
- **Today's Stack** — 5 supplements (Creatine, Whey, Pre-Workout, Omega-3, D3+K2) with `AM/Pre/Post/PM` timing and adherence % .
- **This Week** — 7-day volume chart (plate stacks) + week summary.
- **Fuel Today** — Protein / Carbs / Fats / Calories bars with targets (e.g. 165P · 240C · 70F) + _Add Meal_ (toast, extensible).
- **Personal Records** — Last 90 days PR table (Bench/Squat/Deadlift/Front Squat/OHP).
- **Streak** — Computed from `localStorage` days (a day counts if any lift or stack item is done; today is forgiven until midnight).

### Additional Sections (long page)
- Hero with stats + trust bar, **The Method** (3 pillars), **Insights** strip, **Program teaser** (3 cards), **Wall of Lifts** testimonials, **Pricing** (Starter / Pro ₹199 / Squad ₹499), **FAQ** (accordion), **CTA**, footer with newsletter (toast, no alert).

### Program Library (`programs.html`)
- 6 proven splits: Full-Body Foundation (3D), Upper/Lower Power (4D), PPL Pro (5D), Bro Split 2.0 (4D), High Frequency (6D), Comp Peaking (5-6D).
- Filter by `All / 3 Day / 4 Day / 5 Day / 6 Day / Strength / Hypertrophy`.
- Detail modal with day-by-day focus + _Set as active program_ (saved to `localStorage` `activeProgram`).

### System
- **Theme** — Light/Dark toggle (masthead), persisted, respects `prefers-color-scheme`.
- **Header** — Floating sticky, shrinks on scroll (`is-scrolled`), backdrop blur.
- **Storage** — `nutrilift:v1` { `theme`, `days: { YYYY-MM-DD: {lifts:[bool], stack:[bool]} }`, `activeProgram` }, pruned to 90 days.
- **Toast** — Minimal premium toast (`#toastStack`) for _Add Meal_, _Get recap_, newsletter.
- **Accessibility** — Skip link, `aria-pressed` on toggles, `aria-live` for toasts, keyboard focus, `prefers-reduced-motion` respected.

---

## 🎨 Design Philosophy

> **Clean UI first → Usability second → Aesthetic details third → Subtle 3D last.**

Previous 3D iteration was toned down intentionally:

- **Before:** heavy parallax, 3 orbs + cursor glow, 20+ tilt cards, continuous rotations.
- **Now:** single static orb (`--iron-red-glow`), faint grid (0.06 opacity), one hero wash. Only **4 elements** have `subtle-tilt` (hero + 3 featured cards) at `1.6deg` max, no shadow follow. No parallax/cursor glow. Reveal is just `fade + 10px rise` (0.45s).

Result: stable, premium, product-site feel — spacing, typography (`Oswald` display, `Inter` body, `IBM Plex Mono` accent), and soft shadows (`--shadow-sm/md/lg`) do the heavy lifting.

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

---

## 📁 Structure

```
Nutrilift/
├── index.html      # Dashboard + long marketing sections
├── programs.html   # Program library + filters + modal
├── style.css       # Tokens, layout, premium clean + subtle 3D accent (~905 lines)
├── script.js       # Theme, streak, log/stack, barbell, reveal, subtle-tilt, toasts, programs modal (~470 lines)
└── README.md
```

Key entry points in code:
- Streak & storage: `script.js:55` `computeStreak`, `script.js:40` `getTodayState`
- Barbell: `script.js:141` `initBarbellProgress`
- Reveal: `script.js:262` `initReveal`
- Subtle tilt: `script.js:280` `initTilt3D` (1.6deg, `.subtle-tilt` only)
- Programs modal: `script.js:367` `initProgramsPage`
- Styles: `style.css:4` tokens, `style.css:180` masthead, `style.css:278` hero, `style.css:891` reveal

---

## 🚀 Getting Started

### Open locally
```bash
# just open — no install
start index.html        # Windows
open index.html         # macOS
# or serve to avoid file:// quirks
npx serve .             # then http://localhost:3000
python -m http.server 8000
```

### Use
1. Check off lifts in **Today's Session** — barbell dots turn red, progress `2/5 → 5/5`.
2. Pop supplements in **Today's Stack** — adherence updates.
3. Toggle **DARK/LIGHT** top-right — persists.
4. Visit **Programs** → filter → _View details_ → _Set as active_.
5. Scroll to see pricing/FAQ, try newsletter (toast).

### Reset data
In browser console:
```js
localStorage.removeItem('nutrilift:v1'); location.reload();
```

---

## ♿ Accessibility & Performance

- `prefers-reduced-motion` disables reveal/tilt.
- Keyboard: `Tab` through nav, `Space/Enter` on toggles, `Esc` closes modal.
- `transform` + `opacity` only for animations, `requestAnimationFrame` for tilt, no heavy canvas.
- Responsive: `1180px` max, grids collapse `3→1`, `4→2→1` at `860/960/540px`, masthead hides nav on `<960px`, hero stacks at `<880px`.

---

## 🗺️ Roadmap Ideas

- Editable lifts (add/rename sets), meal logger incrementing macros, PR auto-update on new best, streak freeze for Pro, export CSV, PWA `manifest` + offline.

---

## 📄 License

No license specified — treat as personal project. Replace pricing copy before commercial use.

Built for lifters, not influencers. **Squat · Bench · Deadlift · Rinse · Repeat.**
