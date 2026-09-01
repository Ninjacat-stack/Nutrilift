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
    const label = toggle.querySelector(".switch-label");
    if (label) label.textContent = isDark ? "LIGHT" : "DARK";
    toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }
  const data = loadStorage();
  data.theme = theme;
  saveStorage(data);
}

function initThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;
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
  if (!header) return;
  const ADD_THRESHOLD = 60;
  const REMOVE_THRESHOLD = 20;
  let isScrolled = false;

  const onScroll = () => {
    const y = window.scrollY;
    if (!isScrolled && y > ADD_THRESHOLD) {
      isScrolled = true;
      header.classList.add("is-scrolled");
    } else if (isScrolled && y < REMOVE_THRESHOLD) {
      isScrolled = false;
      header.classList.remove("is-scrolled");
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initDateAndStreak() {
  const badge = document.getElementById("dateBadge");
  const streakEl = document.getElementById("streakCount");
  if (badge) badge.textContent = formatDateBadge();
  if (streakEl) {
    const data = loadStorage();
    const streak = computeStreak(data);
    streakEl.textContent = streak;
  }
}

function initBarbellProgress() {
  const rows = document.querySelectorAll("#logSheet tbody tr");
  const platesRow = document.getElementById("platesRow");
  if (!platesRow || !rows.length) return;
  const sizes = [22, 19, 16, 14, 12];
  platesRow.innerHTML = "";
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
  const doneEl = document.getElementById("doneCount");
  const totalEl = document.getElementById("totalCount");
  if (!rows.length) return;
  let doneCount = 0;
  rows.forEach((row, i) => {
    const isDone = row.getAttribute("data-done") === "true";
    if (isDone) doneCount++;
    if (discs[i]) discs[i].classList.toggle("loaded", isDone);
  });
  if (doneEl) doneEl.textContent = doneCount;
  if (totalEl) totalEl.textContent = rows.length;
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
  if (!cards.length) return;
  const taken = document.querySelectorAll('.pill-card[data-taken="true"]').length;
  const pct = Math.round((taken / cards.length) * 100);
  const el = document.getElementById("adherencePct");
  if (el) el.textContent = pct;
}

function persistCurrentState() {
  const data = loadStorage();
  const rows = document.querySelectorAll("#logSheet tbody tr");
  const cards = document.querySelectorAll(".pill-card");
  if (!rows.length && !cards.length) return;
  const lifts = Array.from(rows).map(r => r.getAttribute("data-done") === "true");
  const stack = Array.from(cards).map(c => c.getAttribute("data-taken") === "true");
  setTodayState(data, lifts, stack);
  const streak = computeStreak(data);
  const streakEl = document.getElementById("streakCount");
  if (streakEl) streakEl.textContent = streak;
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

// — Editable Lifts — persists exercises + per-day dones in localStorage —
const DEFAULT_EXERCISES = [
  {name:"Barbell Bench Press",sets:"4 × 6",load:"80 kg"},
  {name:"Incline Dumbbell Press",sets:"3 × 10",load:"28 kg"},
  {name:"Weighted Dips",sets:"3 × 8",load:"+15 kg"},
  {name:"Cable Lateral Raise",sets:"4 × 15",load:"10 kg"},
  {name:"Overhead Triceps Extension",sets:"3 × 12",load:"22 kg"}
];
function loadExercises(){ const d=loadStorage(); return d.exercises || DEFAULT_EXERCISES; }
function saveExercises(exs){ const d=loadStorage(); d.exercises=exs; saveStorage(d); }
function collectExercises(){ return Array.from(document.querySelectorAll("#logSheet tbody tr")).map(tr=>({name:tr.querySelector('[data-field="name"]')?.textContent.trim()||"",sets:tr.querySelector('[data-field="sets"]')?.textContent.trim()||"",load:tr.querySelector('[data-field="load"]')?.textContent.trim()||""})); }
function reindexLog(){ document.querySelectorAll("#logSheet tbody tr").forEach((tr,i)=>{ const idx=tr.querySelector(".idx"); if(idx) idx.textContent=String(i+1).padStart(2,"0"); const btn=tr.querySelector(".check-btn"); if(btn) btn.setAttribute("aria-label",`Mark ${tr.querySelector('[data-field="name"]')?.textContent.trim()} complete`); }); }
function initEditableLog(){
  const tbody=document.querySelector("#logSheet tbody"), addBtn=document.getElementById("addLiftBtn"), resetBtn=document.getElementById("resetLiftsBtn");
  if(!tbody) return;
  // hydrate from stored exercises if differs from default
  const stored=loadExercises(); if(stored.length!==5 || stored.some((e,i)=> e.name!==DEFAULT_EXERCISES[i]?.name || e.sets!==DEFAULT_EXERCISES[i]?.sets || e.load!==DEFAULT_EXERCISES[i]?.load)){
    // rebuild to match stored (keep dones if possible)
    const data=loadStorage(); const today=data.days?.[todayKey()]; const dones=today?.lifts||[];
    tbody.innerHTML=stored.map((ex,i)=>`<tr data-done="${dones[i]?"true":"false"}"><td class="idx mono">${String(i+1).padStart(2,"0")}</td><td contenteditable="true" data-field="name" spellcheck="false">${ex.name}</td><td class="mono" contenteditable="true" data-field="sets" spellcheck="false">${ex.sets}</td><td class="mono" contenteditable="true" data-field="load" spellcheck="false">${ex.load}</td><td class="th-check" style="display:flex; gap:6px; justify-content:center; align-items:center;"><button type="button" class="check-btn" aria-pressed="${dones[i]?"true":"false"}" aria-label="Mark ${ex.name} complete"></button><button type="button" class="del-lift" aria-label="Delete exercise" title="Delete">×</button></td></tr>`).join("");
    initBarbellProgress();
  }
  tbody.addEventListener("focusout", e=>{ if(e.target.matches('[data-field]')){ saveExercises(collectExercises()); reindexLog(); }});
  tbody.addEventListener("keydown", e=>{ if(e.target.matches('[data-field]') && e.key==="Enter"){ e.preventDefault(); e.target.blur(); }});
  tbody.addEventListener("click", e=>{ const del=e.target.closest(".del-lift"); if(!del) return; const tr=del.closest("tr"); tr.remove(); saveExercises(collectExercises()); reindexLog(); initBarbellProgress(); persistCurrentState(); window.NutriliftToast&&window.NutriliftToast("Exercise removed"); });
  addBtn?.addEventListener("click",()=>{ const tr=document.createElement("tr"); tr.setAttribute("data-done","false"); const n=tbody.children.length+1; tr.innerHTML=`<td class="idx mono">${String(n).padStart(2,"0")}</td><td contenteditable="true" data-field="name" spellcheck="false">New Exercise</td><td class="mono" contenteditable="true" data-field="sets" spellcheck="false">3 × 10</td><td class="mono" contenteditable="true" data-field="load" spellcheck="false">20 kg</td><td class="th-check" style="display:flex; gap:6px; justify-content:center; align-items:center;"><button type="button" class="check-btn" aria-pressed="false" aria-label="Mark New Exercise complete"></button><button type="button" class="del-lift" aria-label="Delete exercise" title="Delete">×</button></td>`; tbody.appendChild(tr); saveExercises(collectExercises()); initBarbellProgress(); persistCurrentState(); tr.querySelector('[data-field="name"]').focus(); });
  resetBtn?.addEventListener("click",()=>{ if(!confirm("Reset to Push Day default?")) return; saveExercises(DEFAULT_EXERCISES); location.reload(); });
}

// — Fuel — persisted per day in localStorage days[date].fuel —
// Targets 165P/240C/70F/2200kcal; auto-estimates kcal if empty; caps at sane max
const FUEL_TARGETS = { protein:165, carbs:240, fats:70, kcal:2200 };
function getFuelToday(){
  const d=loadStorage().days?.[todayKey()]?.fuel;
  return d || { protein:90, carbs:150, fats:38, kcal:1300 };
}
function saveFuelToday(fuel){
  const data=loadStorage(); const k=todayKey();
  if(!data.days) data.days={}; if(!data.days[k]) data.days[k]={ lifts:[], stack:[] };
  data.days[k].fuel=fuel; pruneOldDays(data); saveStorage(data);
}
function updateFuelUI(fuel){
  const t=FUEL_TARGETS;
  const pct=(v, target)=> Math.min(100, Math.round(v/target*100));
  const set=(id, val, target, unit)=>{ const txt=document.getElementById(id); if(txt) txt.textContent=`${val} / ${target} ${unit}`; };
  const bar=(id, val, target)=>{ const el=document.getElementById(id); if(!el) return; const p=pct(val,target); el.parentElement.parentElement.style.setProperty("--pct", p); el.parentElement.parentElement.classList.toggle("over", val>=target); };
  set("proteinText", fuel.protein, t.protein, "g"); bar("proteinFill", fuel.protein, t.protein);
  set("carbsText", fuel.carbs, t.carbs, "g"); bar("carbsFill", fuel.carbs, t.carbs);
  set("fatsText", fuel.fats, t.fats, "g"); bar("fatsFill", fuel.fats, t.fats);
  set("kcalText", fuel.kcal, t.kcal, "kcal"); bar("kcalFill", fuel.kcal, t.kcal);
  const head=document.getElementById("fuelKcalHead"); if(head) head.textContent=`${fuel.kcal} / ${t.kcal} kcal`;
}
function initFuel(){
  const panel=document.getElementById("fuelPanel"); if(!panel) return;
  const form=document.getElementById("mealForm"), addBtn=document.getElementById("addMealBtn"), cancelBtn=document.getElementById("cancelMealBtn"), resetBtn=document.getElementById("resetFuelBtn");
  if(!form||!addBtn) return;
  updateFuelUI(getFuelToday());
  addBtn.addEventListener("click",()=>{ form.hidden=!form.hidden; if(!form.hidden) document.getElementById("mProtein")?.focus(); });
  cancelBtn?.addEventListener("click",()=>{ form.hidden=true; form.reset(); });
  resetBtn?.addEventListener("click",()=>{ saveFuelToday({protein:0,carbs:0,fats:0,kcal:0}); updateFuelUI(getFuelToday()); window.NutriliftToast&&window.NutriliftToast("Fuel reset for today"); });
  const presets={ whey:{p:25,c:3,f:2,k:130}, meal:{p:35,c:45,f:15,k:455}, snack:{p:10,c:20,f:8,k:190} };
  form.querySelectorAll("[data-preset]").forEach(b=> b.addEventListener("click",()=>{ const pr=presets[b.dataset.preset]; if(!pr) return; document.getElementById("mProtein").value=pr.p; document.getElementById("mCarbs").value=pr.c; document.getElementById("mFats").value=pr.f; document.getElementById("mKcal").value=pr.k; }));
  form.addEventListener("submit",e=>{
    e.preventDefault();
    let p=parseInt(document.getElementById("mProtein").value)||0, c=parseInt(document.getElementById("mCarbs").value)||0, f=parseInt(document.getElementById("mFats").value)||0, k=parseInt(document.getElementById("mKcal").value)||0;
    if(!p&&!c&&!f&&!k){ window.NutriliftToast&&window.NutriliftToast("Enter at least one value"); return; }
    if(!k && (p||c||f)) k = p*4 + c*4 + f*9; // auto-estimate kcal if empty
    const cur=getFuelToday(); const next={ protein:Math.min(600,cur.protein+p), carbs:Math.min(800,cur.carbs+c), fats:Math.min(300,cur.fats+f), kcal:Math.min(6000,cur.kcal+k) };
    saveFuelToday(next); updateFuelUI(next); form.reset(); form.hidden=true;
    window.NutriliftToast&&window.NutriliftToast(`+${p}P · +${c}C · +${f}F · +${k} kcal saved`);
  });
  // also persist fuel to history export
  const origExport = window.NutriliftToast; // keep ref for later use
}

// — Reveal — clean fade + slight rise only
function initReveal() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;
  const els = document.querySelectorAll(".hero, .method, .panel, .insights, .programs-teaser, .testimonials, .pricing, .faq, .cta-banner, .programs-hero");
  if (!els.length) return;
  els.forEach(el => el.classList.add("reveal"));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -32px 0px" });
  els.forEach(el => io.observe(el));
}

// — Subtle Tilt — only for .subtle-tilt, very minimal 1.6deg, no shadow follow
function initTilt3D() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (prefersReduced || isTouch) return;
  const cards = document.querySelectorAll(".subtle-tilt[data-tilt]");
  if (!cards.length) return;
  const MAX_ROT = 1.6;

  cards.forEach(card => {
    let raf = null;
    let mx = 0, my = 0;
    let hovering = false;

    const onMove = (e) => {
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      mx = (e.clientX - cx) / (r.width/2);
      my = (e.clientY - cy) / (r.height/2);
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const apply = () => {
      raf = null;
      if (!hovering) return;
      const ry = mx * MAX_ROT;
      const rx = -my * MAX_ROT;
      card.style.transform = `perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    };
    const enter = () => { hovering = true; card.style.transition = "transform 0.08s linear"; };
    const leave = () => {
      hovering = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      card.style.transition = "transform 0.38s cubic-bezier(0.2,0.8,0.2,1)";
      card.style.transform = "";
    };
    card.addEventListener("mouseenter", enter, { passive: true });
    card.addEventListener("mousemove", onMove, { passive: true });
    card.addEventListener("mouseleave", leave, { passive: true });
    card.addEventListener("blur", leave);
  });
}

// — Shortcuts — t: theme, ?: help
function initShortcuts(){
  document.addEventListener("keydown", e=>{
    if(e.target.matches("input, textarea")) return;
    if(e.key==="t"||e.key==="T"){ e.preventDefault(); document.getElementById("themeToggle")?.click(); }
    if(e.key==="?"||(e.key==="/"&&e.shiftKey)){ e.preventDefault(); window.NutriliftToast&&window.NutriliftToast("Shortcuts: t → theme · ? → help · Esc → close modal"); }
  });
}
// — Parallax & cursor glow disabled for clean premium feel — kept as no-ops for compat
function initParallax() { return; }
function initCursorGlow() { return; }

// — Toast — minimal premium feedback
function initToasts() {
  const stack = document.getElementById("toastStack");
  if (!stack) return;
  function show(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.textContent = msg;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }
  window.NutriliftToast = show;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toast]");
    if (!btn) return;
    const msg = btn.getAttribute("data-toast");
    if (msg) show(msg);
  });
  // inline forms fallback already call window.NutriliftToast directly
}

// — History page — 90d calendar + export (small, <35 lines logic) —
function initHistoryPage(){
  const cal=document.getElementById("historyCal"); if(!cal) return;
  const data=loadStorage(); const days=data.days||{};
  const fmt=k=>k.slice(5).replace("-","/"); const today=new Date();
  let streak=computeStreak(data), total=Object.keys(days).length;
  let taken=0, possible=0; Object.values(days).forEach(d=>{ if(d.stack){ taken+=d.stack.filter(Boolean).length; possible+=d.stack.length; }});
  let adh=possible?Math.round(taken/possible*100):0;
  const set=(id,v)=>{const e=document.getElementById(id); if(e) e.textContent=v;};
  set("hStreak",streak); set("hSessions",total); set("hAdherence",adh+"%");
  set("breakdownMeta", total+" sessions · "+adh+"% adherence");
  // calendar 90 days
  const cells=[]; for(let i=89;i>=0;i--){ const d=new Date(today); d.setDate(today.getDate()-i); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const v=days[k]; let cls=""; if(v){ const l=v.lifts?.some(Boolean), s=v.stack?.some(Boolean); if(l&&s) cls="done"; else if(l||s) cls="partial"; } if(k===todayKey()) cls+=(cls?" ":"")+"today"; cells.push({k,cls,v}); }
  cal.innerHTML=cells.map(c=>`<button type="button" class="cal-day ${c.cls}" data-k="${c.k}" aria-label="${c.k}">${c.k.slice(8)}</button>`).join("");
  const r=document.getElementById("calRange"); if(r) r.textContent=fmt(cells[0].k)+" — "+fmt(cells[cells.length-1].k);
  const recent=document.getElementById("recentList"); if(recent){ const last=cells.slice(-14).reverse().filter(c=>c.v); recent.innerHTML=last.length?last.map(c=>`<div class="recent-row ${c.cls.includes("done")?"done":""}"><span class="mono">${c.k}</span><span class="mono">${(c.v.lifts?.filter(Boolean).length||0)}/5 lifts · ${(c.v.stack?.filter(Boolean).length||0)}/5 stack</span></div>`).join(""):`<div class="mono" style="font-size:12px; color:var(--muted);">No logs yet — check a lift on the dashboard.</div>`; }
  const breakdown=document.getElementById("breakdown"); if(breakdown){
    const fuelDays=Object.values(days).filter(d=>d.fuel); const avgKcal=fuelDays.length?Math.round(fuelDays.reduce((a,d)=>a+(d.fuel.kcal||0),0)/fuelDays.length):0;
    breakdown.innerHTML=`<div class="recent-row"><span>Lifts logged</span><span class="mono">${Object.values(days).reduce((a,d)=>a+(d.lifts?.filter(Boolean).length||0),0)}</span></div><div class="recent-row"><span>Stack taken</span><span class="mono">${taken}/${possible}</span></div><div class="recent-row"><span>Avg kcal</span><span class="mono">${avgKcal} kcal</span></div><div class="recent-row"><span>Best streak</span><span class="mono">${streak} days</span></div>`;
  }
  const detail=document.getElementById("dayDetail"); cal.addEventListener("click",e=>{ const b=e.target.closest(".cal-day"); if(!b||!detail) return; const k=b.dataset.k; const v=days[k]; const f=v?.fuel; detail.style.display="block"; detail.innerHTML=v?`<strong class="mono">${k}</strong> — ${(v.lifts?.filter(Boolean).length||0)} lifts · ${(v.stack?.filter(Boolean).length||0)} stack${f?` · ${f.kcal} kcal (${f.protein}P ${f.carbs}C ${f.fats}F)`:""}`:`<span class="mono">${k}: no data</span>`; });
  const doExport=()=>{ const rows=[["date","lifts_done","stack_done","protein","carbs","fats","kcal"]]; Object.keys(days).sort().forEach(k=>{ const d=days[k]; const f=d.fuel||{protein:0,carbs:0,fats:0,kcal:0}; rows.push([k, (d.lifts?.filter(Boolean).length||0), (d.stack?.filter(Boolean).length||0), f.protein, f.carbs, f.fats, f.kcal]); }); const csv=rows.map(r=>r.join(",")).join("\n"); const blob=new Blob([csv],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="nutrilift-history.csv"; a.click(); window.NutriliftToast&&window.NutriliftToast("CSV with fuel downloaded"); };
  const doClear=()=>{ if(!confirm("Clear 90-day history?")) return; data.days={}; saveStorage(data); location.reload(); };
  ["exportBtn","footerExport"].forEach(id=>{ const e=document.getElementById(id); if(e) e.addEventListener("click",e=>{e.preventDefault(); doExport();}); });
  ["clearBtn","footerClear"].forEach(id=>{ const e=document.getElementById(id); if(e) e.addEventListener("click",e=>{e.preventDefault(); doClear();}); });
}

// — Programs page: filters + modal —
const PROGRAM_DATA = {
  fbf: {
    title: "Full-Body Foundation — 3 Day",
    desc: "3 sessions per week, full-body each day. Rotate squat/bench/row patterns. Perfect for beginners or time-crunched lifters.",
    meta: ["3× week", "45 min", "Beginner", "Hypertrophy"],
    rows: [["Mon","Full Body A","Squat 3×5 · Bench 3×6 · Row 3×8"],["Wed","Full Body B","Front Squat 3×6 · OHP 3×8 · RDL 3×10"],["Fri","Full Body A+","Squat 3×5 · Incline Press 3×10 · Lat Pulldown 3×12"]]
  },
  ul: {
    title: "Upper / Lower Power — 4 Day",
    desc: "Heavy upper, heavy lower, volume upper, volume lower. Undulating periodization keeps PRs moving.",
    meta: ["4× week","70 min","Intermediate","Strength"],
    rows: [["Mon","Upper Heavy","Bench 4×4 · Row 4×6 · OHP 3×8"],["Tue","Lower Heavy","Squat 4×4 · RDL 3×6 · Leg Press 3×10"],["Thu","Upper Volume","Bench 3×10 · Pull-up 3×10 · Lateral Raise 4×15"],["Fri","Lower Volume","Front Squat 3×8 · Deadlift 3×5 · Calf Raise 4×15"]]
  },
  ppl: {
    title: "Push / Pull / Legs Pro — 5 Day",
    desc: "Our most-logged split. Push, pull, legs, then upper & lower volume days. Progressive overload built week-to-week.",
    meta: ["5× week","70 min","Intermediate","PPL"],
    rows: [["Mon","Push","Bench 4×6 · OHP 3×8 · Dips 3×10"],["Tue","Pull","Deadlift 3×5 · Row 4×8 · Curl 3×12"],["Wed","Legs","Squat 4×6 · RDL 3×8 · Leg Curl 3×12"],["Thu","Upper","Incline Bench 3×10 · Pull-up 3×8 · Lateral Raise 4×15"],["Fri","Lower","Front Squat 3×8 · Hip Thrust 3×10 · Calf 4×15"]]
  },
  bro: {
    title: "Bro Split 2.0 — 4 Day",
    desc: "Chest, Back, Legs, Arms — curated with modern volume science. No junk sets, every set has a purpose.",
    meta: ["4× week","60 min","Hypertrophy","High volume"],
    rows: [["Mon","Chest + Tris","Bench 4×8 · Incline DB 3×10 · Triceps 3×12"],["Tue","Back + Bis","Row 4×8 · Lat Pulldown 3×12 · Curl 3×12"],["Thu","Legs","Squat 4×6 · Leg Press 3×12 · RDL 3×10"],["Fri","Arms + Delts","OHP 3×8 · Lateral Raise 4×15 · Superset Arms 3×12"]]
  },
  hf: {
    title: "High Frequency — 6 Day",
    desc: "6 short sessions, each muscle twice per week. Great for intermediates who love daily momentum.",
    meta: ["6× week","40 min","Advanced","Frequency"],
    rows: [["Mon","Push A","Bench 3×6 · OHP 3×8 · Triceps 3×12"],["Tue","Pull A","Row 3×8 · Pull-up 3×8 · Curl 3×12"],["Wed","Legs A","Squat 3×5 · RDL 3×8 · Leg Extension 3×12"],["Thu","Push B","Incline Bench 3×10 · Dips 3×10 · Lateral Raise 3×15"],["Fri","Pull B","Deadlift 3×5 · Seated Row 3×10 · Face Pull 3×15"],["Sat","Legs B","Front Squat 3×8 · Hip Thrust 3×10 · Calf 4×15"]]
  },
  peak: {
    title: "Comp Peaking Cycle — 8 Weeks",
    desc: "Peak for SBD. Heavy singles with back-offs, then taper. Test day week 8. Not for beginners.",
    meta: ["5-6× week","90 min","Advanced","Peaking"],
    rows: [["Mon","Squat Heavy","Squat 5×3 @85% · Paused Squat 3×4"],["Tue","Bench Heavy","Bench 5×3 @85% · Close-Grip 3×6"],["Thu","Deadlift Heavy","Deadlift 4×3 @85% · RDL 3×6"],["Fri","Volume Upper","Bench 3×8 · Row 4×8 · OHP 3×10"],["Sat","Volume Lower","Front Squat 3×6 · Leg Press 3×10"]]
  }
};

function initProgramsPage() {
  const grid = document.getElementById("programsGrid");
  const filterRow = document.getElementById("filterRow");
  const modal = document.getElementById("programModal");
  if (!grid) return;

  // filters
  if (filterRow) {
    filterRow.addEventListener("click", e => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      filterRow.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const f = btn.dataset.filter;
      grid.querySelectorAll(".program-full-card").forEach(card => {
        if (f === "all") card.classList.remove("hidden");
        else {
          const tags = (card.dataset.tags || "").split(" ");
          card.classList.toggle("hidden", !tags.includes(f));
        }
      });
    });
  }

  // modal
  if (!modal) return;
  const modalTitle = document.getElementById("modalTitle");
  const modalDesc = document.getElementById("modalDesc");
  const modalMeta = document.getElementById("modalMeta");
  const modalTableBody = document.querySelector("#modalTable tbody");
  const modalClose = document.getElementById("modalClose");
  const modalSetActive = document.getElementById("modalSetActive");

  let activeKey = null;

  function openModal(key) {
    const d = PROGRAM_DATA[key];
    if (!d) return;
    activeKey = key;
    modalTitle.textContent = d.title;
    modalDesc.textContent = d.desc;
    modalMeta.innerHTML = d.meta.map(m => `<span style="background:var(--paper); border:1px solid var(--line); padding:4px 8px; border-radius:20px; font-family:var(--font-mono); font-size:11px; color:var(--muted);">${m}</span>`).join("");
    modalTableBody.innerHTML = d.rows.map(r => `<tr><td class="mono">${r[0]}</td><td>${r[1]}</td><td class="mono" style="font-size:11px; color:var(--ink-soft);">${r[2]}</td></tr>`).join("");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeKey = null;
  }

  grid.addEventListener("click", e => {
    const btn = e.target.closest("[data-program]");
    if (!btn) return;
    openModal(btn.dataset.program);
  });

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });

  modalSetActive.addEventListener("click", () => {
    if (!activeKey) return;
    const data = loadStorage();
    data.activeProgram = activeKey;
    saveStorage(data);
    modalSetActive.textContent = "✓ Active — synced to log";
    modalSetActive.style.background = "var(--success)";
    modalSetActive.style.borderColor = "var(--success)";
    setTimeout(() => {
      closeModal();
      modalSetActive.textContent = "Set as active program";
      modalSetActive.style.background = "";
      modalSetActive.style.borderColor = "";
    }, 900);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initHeaderShrink();
  initDateAndStreak();
  initEditableLog();
  initBarbellProgress();
  initCheckButtons();
  initStackAdherence();
  loadPersistedState();
  initFuel();
  initReveal();
  initTilt3D();
  initParallax();
  initCursorGlow();
  initToasts();
  initShortcuts();
  initProgramsPage();
  initHistoryPage();
});
