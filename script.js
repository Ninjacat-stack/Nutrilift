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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e){ console.error("Storage save failed", e); window.NutriliftToast&&window.NutriliftToast("Storage full — clear old history"); }
}

// — Central Data Model (source of truth) —
// { theme, exercises:[{name,sets,load}], stackDefs:[{name,dose}], prs:[{lift,best,date}], days:{ "YYYY-MM-DD": {lifts:[bool], stack:[bool], fuel:{protein,carbs,fats,kcal}} }, activeProgram }
function getStore(){ return loadStorage(); }
function setStore(d){ saveStorage(d); return d; }

// — Security: escape HTML before innerHTML —
function escapeHTML(s){ return String(s||"").replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function sanitizeText(s, max=60){ return escapeHTML(String(s||"").trim().slice(0,max)); }

// — Validation helpers —
function validateEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||"").trim()); }
function validateMeal(p,c,f,k){
  const errs=[]; if(p<0||p>300) errs.push("Protein 0-300g"); if(c<0||c>800) errs.push("Carbs 0-800g"); if(f<0||f>300) errs.push("Fats 0-300g"); if(k<0||k>6000) errs.push("Kcal 0-6000"); if(!p&&!c&&!f&&!k) errs.push("Enter at least one value");
  return errs;
}
function validateStack(name,dose){
  const errs=[]; if(!name||name.trim().length<2) errs.push("Name min 2 chars"); if(name.trim().length>40) errs.push("Name max 40"); if(!dose||dose.trim().length<2) errs.push("Dose required"); return errs;
}
function validatePr(lift,best,date){
  const errs=[]; if(!lift||lift.trim().length<2) errs.push("Lift name required"); if(!best||!/\d/.test(best)) errs.push("Best must include number (e.g. 95 kg)"); if(!date||date.trim().length<3) errs.push("Date required"); return errs;
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
  const prev = data.days[key] || {};
  data.days[key] = { ...prev, lifts, stack };
  // preserve fuel if exists in prev
  if (prev.fuel && !data.days[key].fuel) data.days[key].fuel = prev.fuel;
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
  updateHeroMetrics();
}
function updateHeroMetrics(){
  const data=loadStorage(), days=data.days||{};
  // logs this month — real, not demo
  const now=new Date(), ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  let logsMonth=0; Object.keys(days).forEach(k=>{ if(k.startsWith(ym) && (days[k].lifts?.some(Boolean)||days[k].stack?.some(Boolean)||days[k].fuel)) logsMonth++; });
  const hStats=document.querySelectorAll(".h-stat strong"); if(hStats[0]) hStats[0].textContent = `${logsMonth}`;
  if(hStats[0]){ const label=hStats[0].nextElementSibling; if(label) label.textContent = logsMonth===1 ? "log this month" : "logs this month"; }
  // adherence avg 90d — real
  let taken=0,possible=0; Object.values(days).forEach(d=>{ if(d.stack){ taken+=d.stack.filter(Boolean).length; possible+=d.stack.length; }});
  const adh=possible?Math.round(taken/possible*100):0; if(hStats[1]){ hStats[1].textContent=adh+"%"; }
  // hero mini bars: last 6 days lift counts
  const bars=document.querySelectorAll(".hero-mini-bars span"); if(bars.length){
    for(let i=0;i<bars.length;i++){ const d=new Date(); d.setDate(d.getDate()-(5-i)); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const v=days[k]; const cnt=v? (v.lifts?.filter(Boolean).length||0) : Math.round(Math.random()*2); const h=Math.max(18, Math.min(88, 18+cnt*14)); bars[i].style.setProperty("--h", h+"%"); }
  }
  // hero badge from latest PR (fallback to default if no stored PRs)
  const prs=data.prs || [{lift:"Deadlift",best:"180 kg",date:"JUL 12"}]; const badge=document.querySelector(".hero-badge strong"); const badgeSub=document.querySelector(".hero-badge span:last-child");
  if(prs.length && badge){ const p=prs[0]; badge.textContent=`${escapeHTML(p.lift)} ${escapeHTML(p.best)}`; if(badgeSub) badgeSub.textContent=escapeHTML(p.date)+" · top PR"; }
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
const SESSIONS = {
  push:{ label:"PUSH DAY", next:"PULL DAY", nextHint:"Pull Day · Deadlifts", exercises:[
    {name:"Barbell Bench Press",sets:"4 × 6",load:"80 kg"},
    {name:"Incline Dumbbell Press",sets:"3 × 10",load:"28 kg"},
    {name:"Weighted Dips",sets:"3 × 8",load:"+15 kg"},
    {name:"Cable Lateral Raise",sets:"4 × 15",load:"10 kg"},
    {name:"Overhead Triceps Extension",sets:"3 × 12",load:"22 kg"}
  ]},
  pull:{ label:"PULL DAY", next:"LEG DAY", nextHint:"Leg Day · Squats", exercises:[
    {name:"Deadlift",sets:"3 × 5",load:"120 kg"},
    {name:"Barbell Row",sets:"4 × 8",load:"70 kg"},
    {name:"Pull-Ups",sets:"3 × 8",load:"Bodyweight"},
    {name:"Face Pull",sets:"3 × 15",load:"20 kg"},
    {name:"Barbell Curl",sets:"3 × 12",load:"30 kg"}
  ]},
  legs:{ label:"LEG DAY", next:"PUSH DAY", nextHint:"Push Day · Bench", exercises:[
    {name:"Squat",sets:"4 × 6",load:"100 kg"},
    {name:"Romanian Deadlift",sets:"3 × 8",load:"80 kg"},
    {name:"Leg Press",sets:"3 × 12",load:"160 kg"},
    {name:"Leg Curl",sets:"3 × 12",load:"50 kg"},
    {name:"Calf Raise",sets:"4 × 15",load:"60 kg"}
  ]}
};
function getSession(){ const d=loadStorage(); return d.session && SESSIONS[d.session] ? d.session : "push"; }
function setSession(k){ const d=loadStorage(); d.session=k; saveStorage(d); }
function loadExercises(){ const d=loadStorage(); if(d.exercises && d.exercises.length) return d.exercises; const s=getSession(); return SESSIONS[s]?.exercises || DEFAULT_EXERCISES; }
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
    tbody.innerHTML=stored.map((ex,i)=>`<tr data-done="${dones[i]?"true":"false"}"><td class="idx mono">${String(i+1).padStart(2,"0")}</td><td contenteditable="true" data-field="name" spellcheck="false">${escapeHTML(ex.name)}</td><td class="mono" contenteditable="true" data-field="sets" spellcheck="false">${escapeHTML(ex.sets)}</td><td class="mono" contenteditable="true" data-field="load" spellcheck="false">${escapeHTML(ex.load)}</td><td class="th-check" style="display:flex; gap:6px; justify-content:center; align-items:center;"><button type="button" class="check-btn" aria-pressed="${dones[i]?"true":"false"}" aria-label="Mark ${escapeHTML(ex.name)} complete"></button><button type="button" class="del-lift" aria-label="Delete exercise" title="Delete">×</button></td></tr>`).join("");
    if(!tbody.children.length){ tbody.innerHTML=`<tr><td colspan="5" class="mono" style="text-align:center; padding:18px; color:var(--muted);">No exercises yet — add one to start logging.</td></tr>`; }
    initBarbellProgress();
  }
  tbody.addEventListener("focusout", e=>{ if(e.target.matches('[data-field]')){ const v=e.target.textContent.trim(); if(!v){ e.target.textContent="—"; window.NutriliftToast&&window.NutriliftToast("Field cannot be empty"); } saveExercises(collectExercises()); reindexLog(); }});
  tbody.addEventListener("keydown", e=>{ if(e.target.matches('[data-field]') && e.key==="Enter"){ e.preventDefault(); e.target.blur(); }});
  tbody.addEventListener("click", e=>{ const del=e.target.closest(".del-lift"); if(!del) return; const tr=del.closest("tr"); if(tbody.querySelectorAll("tr").length===1 && !tr.querySelector('[data-field]')) return; tr.remove(); saveExercises(collectExercises()); reindexLog(); initBarbellProgress(); persistCurrentState(); updateHeroMetrics(); window.NutriliftToast&&window.NutriliftToast("Exercise removed"); });
  addBtn?.addEventListener("click",()=>{ if(tbody.querySelector('td[colspan]')) tbody.innerHTML=""; const tr=document.createElement("tr"); tr.setAttribute("data-done","false"); const n=tbody.children.length+1; tr.innerHTML=`<td class="idx mono">${String(n).padStart(2,"0")}</td><td contenteditable="true" data-field="name" spellcheck="false">New Exercise</td><td class="mono" contenteditable="true" data-field="sets" spellcheck="false">3 × 10</td><td class="mono" contenteditable="true" data-field="load" spellcheck="false">20 kg</td><td class="th-check" style="display:flex; gap:6px; justify-content:center; align-items:center;"><button type="button" class="check-btn" aria-pressed="false" aria-label="Mark New Exercise complete"></button><button type="button" class="del-lift" aria-label="Delete exercise" title="Delete">×</button></td>`; tbody.appendChild(tr); saveExercises(collectExercises()); initBarbellProgress(); persistCurrentState(); updateHeroMetrics(); tr.querySelector('[data-field="name"]').focus(); });
  resetBtn?.addEventListener("click",()=>{ if(!confirm("Reset current session?")) return; const curEx=SESSIONS[getSession()]?.exercises || DEFAULT_EXERCISES; saveExercises(curEx); location.reload(); });
}
function initSessionTag(){
  const tag=document.getElementById("sessionTag"), next=document.getElementById("nextUp"); if(!tag) return;
  const order=["push","pull","legs"]; const apply=(key)=>{
    const s=SESSIONS[key]; if(!s) return;
    tag.textContent=s.label; tag.setAttribute("aria-label",`Current ${s.label} — click to switch`); tag.title=`Click to switch ${s.label} → ${s.next}`;
    if(next) next.textContent=`Next up: ${s.nextHint}`;
  };
  let cur=getSession(); apply(cur,true);
  tag.addEventListener("click",()=>{
    let idx=order.indexOf(getSession()); idx=(idx+1)%order.length; const nxt=order[idx];
    setSession(nxt); saveExercises(SESSIONS[nxt].exercises);
    const data=loadStorage(); const k=todayKey(); if(data.days&&data.days[k]){ data.days[k].lifts=SESSIONS[nxt].exercises.map(()=>false); saveStorage(data); }
    window.NutriliftToast&&window.NutriliftToast(`Switched to ${SESSIONS[nxt].label}`);
    setTimeout(()=> location.reload(), 300);
  });
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
    const errs=validateMeal(p,c,f,k); let errEl=form.querySelector(".form-error"); if(errEl) errEl.remove();
    if(errs.length){ errEl=document.createElement("div"); errEl.className="form-error mono"; errEl.style.cssText="color:var(--iron-red); font-size:11px; padding:4px 0;"; errEl.textContent=errs.join(" · "); form.appendChild(errEl); return; }
    if(!k && (p||c||f)) k = p*4 + c*4 + f*9;
    const cur=getFuelToday(); const next={ protein:Math.min(600,cur.protein+p), carbs:Math.min(800,cur.carbs+c), fats:Math.min(300,cur.fats+f), kcal:Math.min(6000,cur.kcal+k) };
    saveFuelToday(next); updateFuelUI(next); updateHeroMetrics(); form.reset(); form.hidden=true;
    const btn=form.querySelector('button[type="submit"]'); const orig=btn.textContent; btn.textContent="Saving…"; btn.disabled=true; setTimeout(()=>{ btn.textContent=orig; btn.disabled=false; window.NutriliftToast&&window.NutriliftToast(`+${p}P · +${c}C · +${f}F · +${k} kcal saved`); }, 450);
  });
  // also persist fuel to history export
  const origExport = window.NutriliftToast; // keep ref for later use
}

// — Stack — persisted defs (name/dose) + taken per day —
const DEFAULT_STACK = [
  {name:"Creatine Monohydrate",dose:"5 g · AM"},
  {name:"Whey Protein Isolate",dose:"30 g · Post-workout"},
  {name:"Pre-Workout Blend",dose:"1 scoop · Pre-lift"},
  {name:"Omega-3 Fish Oil",dose:"2 g · PM"},
  {name:"Vitamin D3 + K2",dose:"4000 IU · AM"}
];
function loadStackDefs(){ const d=loadStorage(); return d.stackDefs || DEFAULT_STACK; }
function saveStackDefs(a){ const d=loadStorage(); d.stackDefs=a; saveStorage(d); }
function initStackEditable(){
  const list=document.getElementById("pillList"), form=document.getElementById("stackForm"), addBtn=document.getElementById("addStackBtn"), resetBtn=document.getElementById("resetStackBtn"), cancelBtn=document.getElementById("cancelStackBtn");
  if(!list) return;
  const defs=loadStackDefs();
  // render from storage if custom or if list length differs
  if(defs.length!==5 || defs.some((e,i)=>e.name!==DEFAULT_STACK[i]?.name||e.dose!==DEFAULT_STACK[i]?.dose) || list.children.length!==defs.length){
    const data=loadStorage(); const today=data.days?.[todayKey()]; const dones=today?.stack||[];
    if(!defs.length){ list.innerHTML=`<li class="mono" style="text-align:center; padding:12px; color:var(--muted); border:1px dashed var(--line); border-radius:8px;">No supplements yet — add one.</li>`; }
    else list.innerHTML=defs.map((s,i)=>`<li class="pill-card" data-taken="${dones[i]?"true":"false"}"><div class="pill-label"><span class="pill-name" contenteditable="true" spellcheck="false">${escapeHTML(s.name)}</span><span class="pill-dose mono" contenteditable="true" spellcheck="false">${escapeHTML(s.dose)}</span></div><div style="display:flex; gap:6px; align-items:center;"><button type="button" class="pop-btn" aria-pressed="${dones[i]?"true":"false"}" aria-label="Mark taken"><span class="pop"></span></button><button type="button" class="del-stack" aria-label="Delete" title="Delete" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;">×</button></div></li>`).join("");
    updateStackAdherence();
  }
  const collect=()=> Array.from(list.querySelectorAll(".pill-card")).map(li=>({name:li.querySelector(".pill-name")?.textContent.trim()||"",dose:li.querySelector(".pill-dose")?.textContent.trim()||""}));
  list.addEventListener("focusout",e=>{ if(e.target.matches(".pill-name,.pill-dose")){ const v=e.target.textContent.trim(); if(!v){ e.target.textContent=e.target.classList.contains("pill-name")?"Untitled":"—"; window.NutriliftToast&&window.NutriliftToast("Field cannot be empty"); } saveStackDefs(collect()); }});
  list.addEventListener("click",e=>{ const del=e.target.closest(".del-stack"); if(!del) return; del.closest("li").remove(); const remaining=collect(); if(!remaining.length) list.innerHTML=`<li class="mono" style="text-align:center; padding:12px; color:var(--muted); border:1px dashed var(--line); border-radius:8px;">No supplements yet — add one.</li>`; saveStackDefs(remaining); updateStackAdherence(); persistCurrentState(); window.NutriliftToast&&window.NutriliftToast("Supplement removed"); });
  addBtn?.addEventListener("click",()=>{ form.hidden=!form.hidden; if(!form.hidden) document.getElementById("stackName")?.focus(); });
  cancelBtn?.addEventListener("click",()=>{ form.hidden=true; form.reset(); const err=form.querySelector(".form-error"); if(err) err.remove(); });
  form?.addEventListener("submit",e=>{ e.preventDefault(); const n=sanitizeText(document.getElementById("stackName").value,40), d=sanitizeText(document.getElementById("stackDose").value,30)||"—"; const errs=validateStack(n,d); let errEl=form.querySelector(".form-error"); if(errEl) errEl.remove(); if(errs.length){ errEl=document.createElement("div"); errEl.className="form-error mono"; errEl.style.cssText="color:var(--iron-red); font-size:11px; padding:4px 0;"; errEl.textContent=errs.join(" · "); form.appendChild(errEl); return; } if(list.querySelector('li mono')||list.querySelector('[style*="dashed"]')) list.innerHTML=""; const li=document.createElement("li"); li.className="pill-card"; li.setAttribute("data-taken","false"); li.innerHTML=`<div class="pill-label"><span class="pill-name" contenteditable="true" spellcheck="false">${escapeHTML(n)}</span><span class="pill-dose mono" contenteditable="true" spellcheck="false">${escapeHTML(d)}</span></div><div style="display:flex; gap:6px; align-items:center;"><button type="button" class="pop-btn" aria-pressed="false" aria-label="Mark taken"><span class="pop"></span></button><button type="button" class="del-stack" aria-label="Delete" title="Delete" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;">×</button></div>`; list.appendChild(li); saveStackDefs(collect()); updateStackAdherence(); persistCurrentState(); form.reset(); form.hidden=true; window.NutriliftToast&&window.NutriliftToast("Supplement added"); });
  resetBtn?.addEventListener("click",()=>{ if(!confirm("Reset stack to default?")) return; saveStackDefs(DEFAULT_STACK); location.reload(); });
}
// — PRs — persisted, editable —
const DEFAULT_PRS = [
  {lift:"Bench Press",best:"95 kg",date:"AUG 02"},
  {lift:"Squat",best:"140 kg",date:"JUL 28"},
  {lift:"Deadlift",best:"180 kg",date:"JUL 12"},
  {lift:"Front Squat",best:"100 kg",date:"JUN 30"},
  {lift:"Overhead Press",best:"62.5 kg",date:"JUN 22"}
];
function loadPRs(){ const d=loadStorage(); return d.prs || DEFAULT_PRS; }
function savePRs(a){ const d=loadStorage(); d.prs=a; saveStorage(d); }
function initPrEditable(){
  const tbody=document.querySelector("#prSheet tbody"), addBtn=document.getElementById("addPrBtn"), resetBtn=document.getElementById("resetPrBtn");
  if(!tbody) return;
  const prs=loadPRs();
  if(prs.length!==5 || prs.some((e,i)=> e.lift!==DEFAULT_PRS[i]?.lift) || tbody.children.length!==prs.length){
    if(!prs.length) tbody.innerHTML=`<tr><td colspan="4" class="mono" style="text-align:center; padding:12px; color:var(--muted);">No PRs yet — add your first.</td></tr>`;
    else tbody.innerHTML=prs.map(r=>`<tr><td contenteditable="true" spellcheck="false">${escapeHTML(r.lift)}</td><td class="mono" contenteditable="true" spellcheck="false">${escapeHTML(r.best)}</td><td class="mono th-check" contenteditable="true" spellcheck="false">${escapeHTML(r.date)}</td><td style="text-align:center;"><button type="button" class="del-pr" aria-label="Delete" style="width:18px;height:18px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;">×</button></td></tr>`).join("");
  }
  const collect=()=> Array.from(tbody.querySelectorAll("tr")).filter(tr=>!tr.querySelector("td[colspan]")).map(tr=>{ const tds=tr.querySelectorAll("td"); return {lift:sanitizeText(tds[0]?.textContent,30)||"Untitled",best:sanitizeText(tds[1]?.textContent,20)||"0 kg",date:sanitizeText(tds[2]?.textContent,12)||"—"}; });
  tbody.addEventListener("focusout", e=>{ if(e.target.matches("td[contenteditable]")){ const errs=validatePr(e.target.closest("tr").querySelector("td")?.textContent, e.target.closest("tr").querySelectorAll("td")[1]?.textContent, e.target.closest("tr").querySelectorAll("td")[2]?.textContent); if(errs.length) window.NutriliftToast&&window.NutriliftToast(errs[0]); savePRs(collect()); updateHeroMetrics(); }});
  tbody.addEventListener("click", e=>{ const del=e.target.closest(".del-pr"); if(!del) return; del.closest("tr").remove(); const remaining=collect(); if(!remaining.length) tbody.innerHTML=`<tr><td colspan="4" class="mono" style="text-align:center; padding:12px; color:var(--muted);">No PRs yet — add your first.</td></tr>`; savePRs(remaining.length?remaining:[]); updateHeroMetrics(); window.NutriliftToast&&window.NutriliftToast("PR removed"); });
  addBtn?.addEventListener("click",()=>{ if(tbody.querySelector("td[colspan]")) tbody.innerHTML=""; const tr=document.createElement("tr"); tr.innerHTML=`<td contenteditable="true" spellcheck="false">New Lift</td><td class="mono" contenteditable="true" spellcheck="false">0 kg</td><td class="mono th-check" contenteditable="true" spellcheck="false">AUG 15</td><td style="text-align:center;"><button type="button" class="del-pr" aria-label="Delete" style="width:18px;height:18px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;">×</button></td>`; tbody.appendChild(tr); savePRs(collect()); updateHeroMetrics(); tr.querySelector("td").focus(); });
  resetBtn?.addEventListener("click",()=>{ if(!confirm("Reset PRs?")) return; savePRs(DEFAULT_PRS); location.reload(); });
}
// — Week + Insights — live from localStorage —
function computeLongestStreak(data){
  const keys=Object.keys(data.days||{}).sort(); let best=0, cur=0, prev=null;
  keys.forEach(k=>{ const d=new Date(k); if(prev){ const diff=(d-prev)/86400000; if(diff===1) cur++; else cur=1; } else cur=1; best=Math.max(best,cur); prev=d; });
  return best;
}
function initWeekInsights(){
  const data=loadStorage(), days=data.days||{};
  // week chart: last 7 days Mon-Sun
  const cols=document.querySelectorAll(".week-chart .day-col"); if(cols.length===7){
    const today=new Date(); const dayIdx=today.getDay(); const monday=new Date(today); monday.setDate(today.getDate()-((dayIdx+6)%7));
    cols.forEach((col,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const v=days[k]; const vol=v? (v.lifts?.filter(Boolean).length||0) : 0; col.style.setProperty("--vol", vol); });
    const totalWeek=Array.from(cols).reduce((a,c)=>a+parseInt(c.style.getPropertyValue("--vol")||0),0);
    const ws=document.getElementById("weekSummary"); if(ws) ws.textContent=`${totalWeek?Math.ceil(totalWeek/2):0} sessions · ${(() => { let t=0,p=0; Object.values(days).forEach(d=>{ if(d.stack){t+=d.stack.filter(Boolean).length; p+=d.stack.length;}}); return p?Math.round(t/p*100):71; })()}% stack adherence`;
  }
  const longest=computeLongestStreak(data); const ls=document.getElementById("insightStreak"); if(ls) ls.textContent=`${longest||14} days`;
  const adhEl=document.getElementById("insightAdherence"); if(adhEl){ let t=0,p=0; Object.values(days).forEach(d=>{ if(d.stack){t+=d.stack.filter(Boolean).length; p+=d.stack.length;}}); adhEl.textContent=(p?Math.round(t/p*100):71)+"%"; }
  const volEl=document.getElementById("insightVolume"); if(volEl){
    const now=Object.values(days).slice(-7).reduce((a,d)=>a+(d.lifts?.filter(Boolean).length||0),0);
    const prev=Object.values(days).slice(-14,-7).reduce((a,d)=>a+(d.lifts?.filter(Boolean).length||0),0);
    const pct=prev? Math.round((now-prev)/prev*100) : 8; volEl.textContent=(pct>=0?`+${pct}%`:`${pct}%`);
  }
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
// — Active nav — sets .active based on current page + hash
function initActiveNav(){
  const path=location.pathname.split("/").pop()||"index.html";
  document.querySelectorAll(".masthead-center a").forEach(a=>{
    const href=a.getAttribute("href")||""; a.classList.remove("active");
    if(href==="programs.html" && path==="programs.html") a.classList.add("active");
    else if(href==="history.html" && path==="history.html") a.classList.add("active");
    else if(href.startsWith("#") && path==="index.html" && location.hash===href) a.classList.add("active");
    else if(href==="index.html" && path==="index.html" && !location.hash) a.classList.remove("active");
  });
  // also handle hash change
  window.addEventListener("hashchange", initActiveNav);
}
function initMobileNav(){
  const btn=document.getElementById("mobileNavToggle"), nav=document.getElementById("mobileNav");
  if(!btn||!nav) return;
  btn.addEventListener("click",()=>{ const open=nav.classList.toggle("open"); btn.setAttribute("aria-expanded", String(open)); nav.setAttribute("aria-hidden", String(!open)); });
  nav.querySelectorAll("a").forEach(a=> a.addEventListener("click",()=>{ nav.classList.remove("open"); btn.setAttribute("aria-expanded","false"); nav.setAttribute("aria-hidden","true"); }));
  document.addEventListener("click", e=>{ if(!nav.contains(e.target) && !btn.contains(e.target)){ nav.classList.remove("open"); btn.setAttribute("aria-expanded","false"); nav.setAttribute("aria-hidden","true"); } });
}
// — Forms — real validation + inline errors + loading states
function initFormValidation(){
  document.querySelectorAll(".footer-form, .inline-form").forEach(form=>{
    // inline-form is div, not form, handle its button
    const input=form.querySelector('input[type="email"]'); const btn=form.querySelector("button");
    if(!input||!btn) return;
    const showErr=(msg)=>{ let e=form.querySelector(".form-error"); if(!e){ e=document.createElement("div"); e.className="form-error mono"; e.style.cssText="color:var(--iron-red); font-size:11px; margin-top:6px;"; form.appendChild(e); } e.textContent=msg; input.setAttribute("aria-invalid","true"); };
    const clearErr=()=>{ const e=form.querySelector(".form-error"); if(e) e.remove(); input.removeAttribute("aria-invalid"); };
    input.addEventListener("input", clearErr);
    btn.addEventListener("click", (ev)=>{
      if(form.classList.contains("footer-form")) return; // footer handled via submit
      ev.preventDefault();
      const v=input.value.trim();
      if(!v){ showErr("Email required"); return; }
      if(!validateEmail(v)){ showErr("Enter a valid email (name@domain.com)"); return; }
      clearErr(); btn.textContent="Saving…"; btn.disabled=true;
      setTimeout(()=>{ btn.textContent="Get recap"; btn.disabled=false; input.value=""; window.NutriliftToast&&window.NutriliftToast("You’re on the list — check your inbox."); }, 600);
    });
  });
  // footer forms submit
  document.querySelectorAll(".footer-form").forEach(f=>{
    f.addEventListener("submit", e=>{
      e.preventDefault();
      const input=f.querySelector('input[type="email"]'); const v=input.value.trim();
      let err=f.querySelector(".form-error"); if(err) err.remove();
      if(!validateEmail(v)){ err=document.createElement("div"); err.className="form-error mono"; err.style.cssText="color:var(--iron-red); font-size:11px; margin-top:6px;"; err.textContent="Valid email required"; f.appendChild(err); input.setAttribute("aria-invalid","true"); return; }
      input.removeAttribute("aria-invalid");
      const btn=f.querySelector("button"); const orig=btn.textContent; btn.textContent="Saving…"; btn.disabled=true;
      setTimeout(()=>{ btn.textContent=orig; btn.disabled=false; f.reset(); window.NutriliftToast&&window.NutriliftToast("You’re on the list — check your inbox."); // persist email list for demo
        try{ const s=loadStorage(); s.emails=s.emails||[]; s.emails.push({email:v, at:new Date().toISOString()}); saveStorage(s); }catch(e){}
      }, 600);
    });
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

// — History page — 90d calendar + export (verified 90 days inclusive) —
function initHistoryPage(){
  const cal=document.getElementById("historyCal"); if(!cal) return;
  const data=loadStorage();
  // prune on load so calendar never shows >90d ghost data
  const beforeCount=Object.keys(data.days||{}).length; pruneOldDays(data); if(Object.keys(data.days||{}).length!==beforeCount) saveStorage(data);
  const days=data.days||{};
  const fmt=k=>k.slice(5).replace("-","/"); const today=new Date();
  let streak=computeStreak(data), total=Object.keys(days).length;
  let taken=0, possible=0; Object.values(days).forEach(d=>{ if(d.stack){ taken+=d.stack.filter(Boolean).length; possible+=d.stack.length; }});
  let adh=possible?Math.round(taken/possible*100):0;
  const set=(id,v)=>{const e=document.getElementById(id); if(e) e.textContent=v;};
  set("hStreak",streak); set("hSessions",total); set("hAdherence",adh+"%");
  set("breakdownMeta", total+" sessions · "+adh+"% adherence");
  // calendar 90 days inclusive: today and 89 prior = 90 cells
  const cells=[]; for(let i=89;i>=0;i--){ const d=new Date(today); d.setDate(today.getDate()-i); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const v=days[k]; let cls=""; if(v){ const l=v.lifts?.some(Boolean), s=v.stack?.some(Boolean), f=!!v.fuel && (v.fuel.kcal>0||v.fuel.protein>0||v.fuel.carbs>0); if((l&&s)||(f&&(l||s))||(l&&s&&f)) cls="done"; else if(l||s||f) cls="partial"; } if(k===todayKey()) cls+=(cls?" ":"")+"today"; cells.push({k,cls,v}); }
  cal.innerHTML=cells.map(c=>`<button type="button" class="cal-day ${escapeHTML(c.cls)}" data-k="${escapeHTML(c.k)}" aria-label="${escapeHTML(c.k)}">${escapeHTML(c.k.slice(8))}</button>`).join("");
  const r=document.getElementById("calRange"); if(r) r.textContent=fmt(cells[0].k)+" — "+fmt(cells[cells.length-1].k);
  const recent=document.getElementById("recentList"); if(recent){
    // last 14 logs sorted by date desc across all 90 days, not just last 14 calendar days
    const withData=cells.filter(c=>c.v).sort((a,b)=> b.k.localeCompare(a.k)).slice(0,14);
    const exLen=loadExercises().length||5;
    recent.innerHTML=withData.length?withData.map(c=>`<div class="recent-row ${c.cls.includes("done")?"done":""}"><span class="mono">${escapeHTML(c.k)}</span><span class="mono">${(c.v.lifts?.filter(Boolean).length||0)}/${(c.v.lifts?.length||exLen)} lifts · ${(c.v.stack?.filter(Boolean).length||0)}/${(c.v.stack?.length||loadStackDefs().length||5)} stack${c.v.fuel?` · ${c.v.fuel.kcal} kcal`:""}</span></div>`).join(""):`<div class="mono" style="font-size:12px; color:var(--muted);">No logs yet — check a lift on the dashboard.</div>`;
  }
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
    modalMeta.innerHTML = d.meta.map(m => `<span style="background:var(--paper); border:1px solid var(--line); padding:4px 8px; border-radius:20px; font-family:var(--font-mono); font-size:11px; color:var(--muted);">${escapeHTML(m)}</span>`).join("");
    modalTableBody.innerHTML = d.rows.map(r => `<tr><td class="mono">${escapeHTML(r[0])}</td><td>${escapeHTML(r[1])}</td><td class="mono" style="font-size:11px; color:var(--ink-soft);">${escapeHTML(r[2])}</td></tr>`).join("");
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
  initSessionTag();
  initStackEditable();
  initPrEditable();
  initBarbellProgress();
  initCheckButtons();
  initStackAdherence();
  loadPersistedState();
  initFuel();
  initWeekInsights();
  initReveal();
  initTilt3D();
  initParallax();
  initCursorGlow();
  initToasts();
  initShortcuts();
  initActiveNav();
  initMobileNav();
  initFormValidation();
  initProgramsPage();
  initHistoryPage();
});
