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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch(e){ console.error("Storage save failed", e); window.NutriliftToast&&window.NutriliftToast("Storage full — clear old history"); return false; }
}

// — Central Data Model (source of truth) —
// { theme, exercises:[{name,sets,load}], stackDefs:[{name,dose}], prs:[{lift,best,date}], days:{ "YYYY-MM-DD": {lifts:[bool], stack:[bool], fuel:{protein,carbs,fats,kcal}, fuelManual:{}, meals:[{id,name,type,servings,servingSize,nutrition}] } }, bodyweight:{ "YYYY-MM-DD": kg }, activeProgram }

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
function showFormError(form, errs){
  if(!form) return;
  const old=form.querySelector(".form-error"); if(old) old.remove();
  if(!errs||!errs.length) return;
  const el=document.createElement("div"); el.className="form-error mono"; el.style.cssText="color:var(--iron-red); font-size:11px; padding:4px 0;"; el.textContent=errs.join(" · "); form.appendChild(el);
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
  const ADD_THRESHOLD = 60, REMOVE_THRESHOLD = 20;
  let isScrolled = false, ticking = false;
  const update = () => {
    const y = window.scrollY;
    if (!isScrolled && y > ADD_THRESHOLD) { isScrolled = true; header.classList.add("is-scrolled"); }
    else if (isScrolled && y < REMOVE_THRESHOLD) { isScrolled = false; header.classList.remove("is-scrolled"); }
    ticking = false;
  };
  const onScroll = () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } };
  window.addEventListener("scroll", onScroll, { passive: true });
  update();
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
  const y=document.getElementById("footerYear"); if(y) y.textContent=new Date().getFullYear();
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
  // PRs tracked — real count from storage
  const prs=data.prs||[]; if(hStats[2]){ hStats[2].textContent=String(prs.length); const l2=hStats[2].nextElementSibling; if(l2) l2.textContent = prs.length===1 ? "PR tracked" : "PRs tracked"; }
  // hero mini bars: last 6 days lift counts (0 when missing — no fake data)
  const bars=document.querySelectorAll(".hero-mini-bars span"); if(bars.length){
    for(let i=0;i<bars.length;i++){ const d=new Date(); d.setDate(d.getDate()-(5-i)); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const v=days[k]; const cnt=v? (v.lifts?.filter(Boolean).length||0) : 0; const h=Math.max(6, Math.min(88, 6+cnt*16)); bars[i].style.setProperty("--h", h+"%"); }
  }
  // hero session label — real session
  const sLabel=document.getElementById("heroSessionLabel");
  if(sLabel && typeof SESSIONS!=="undefined"){ sLabel.textContent="TODAY · "+(SESSIONS[getSession()]?.label||"PUSH DAY"); }
  // hero stack rows + progress — real defs + today's dones
  const rows=document.querySelectorAll(".hero-stack-row");
  const defs=loadStackDefs();
  const today=data.days?.[todayKey()]; const dones=today?.stack||[];
  rows.forEach((row,i)=>{ const d=defs[i]; if(!d){ row.style.display="none"; return; } row.style.display=""; const name=row.querySelector("span:first-child"); const badge=row.querySelector("span:last-child"); if(name) name.textContent=d.name; if(badge){ badge.textContent=dones[i]?"TAKEN ✓":"PENDING"; badge.className="mono "+(dones[i]?"taken":"pending"); } });
  const sp=document.getElementById("heroStackProgress"); if(sp) sp.style.width=(possible?Math.round(taken/possible*100):0)+"%";
  // hero badge from latest PR (empty state when no PRs)
  const badge=document.querySelector(".hero-badge strong"); const badgeSub=document.querySelector(".hero-badge span:last-child");
  if(badge){ if(prs.length){ const p=prs[0]; badge.textContent=`${escapeHTML(p.lift)} ${escapeHTML(p.best)}`; if(badgeSub) badgeSub.textContent=escapeHTML(p.date)+" · top PR"; } else { badge.textContent="No PRs yet"; if(badgeSub) badgeSub.textContent="Log a lift to start"; } }
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
  const pctEl = document.getElementById("donePct");
  if (pctEl) pctEl.textContent = rows.length ? Math.round(doneCount / rows.length * 100) + "%" : "0%";
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
  if (typeof updateHeroMetrics === "function") updateHeroMetrics();
  if (typeof initWeekInsights === "function") initWeekInsights();
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
function selectAllText(el){ if(!el) return; const range=document.createRange(); range.selectNodeContents(el); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(range); }
function initEditableLog(){
  const tbody=document.querySelector("#logSheet tbody"), addBtn=document.getElementById("addLiftBtn"), resetBtn=document.getElementById("resetLiftsBtn");
  if(!tbody) return;
  // hydrate from stored exercises if differs from default
  const stored=loadExercises(); if(stored.length!==5 || stored.some((e,i)=> e.name!==DEFAULT_EXERCISES[i]?.name || e.sets!==DEFAULT_EXERCISES[i]?.sets || e.load!==DEFAULT_EXERCISES[i]?.load)){
    // rebuild to match stored (keep dones if possible)
    const data=loadStorage(); const today=data.days?.[todayKey()]; const dones=today?.lifts||[];
    tbody.innerHTML=stored.map((ex,i)=>`<tr data-done="${dones[i]?"true":"false"}"><td class="idx mono">${String(i+1).padStart(2,"0")}</td><td contenteditable="true" data-field="name" spellcheck="false">${escapeHTML(ex.name)}</td><td class="mono" contenteditable="true" data-field="sets" spellcheck="false">${escapeHTML(ex.sets)}</td><td class="mono" contenteditable="true" data-field="load" spellcheck="false">${escapeHTML(ex.load)}</td><td class="th-check row-actions"><button type="button" class="check-btn" aria-pressed="${dones[i]?"true":"false"}" aria-label="Mark ${escapeHTML(ex.name)} complete"></button><button type="button" class="del-lift icon-btn" aria-label="Delete exercise" title="Delete">×</button></td></tr>`).join("");
    if(!tbody.children.length){ tbody.innerHTML=`<tr><td colspan="5" class="mono" style="text-align:center; padding:18px; color:var(--muted);">No exercises yet — add one to start logging.</td></tr>`; }
    initBarbellProgress();
  }
  tbody.addEventListener("focusout", e=>{ if(e.target.matches('[data-field]')){ const v=e.target.textContent.trim(); if(!v){ e.target.textContent="—"; window.NutriliftToast&&window.NutriliftToast("Field cannot be empty"); } saveExercises(collectExercises()); reindexLog(); }});
  tbody.addEventListener("keydown", e=>{ if(e.target.matches('[data-field]') && e.key==="Enter"){ e.preventDefault(); e.target.blur(); }});
  tbody.addEventListener("click", e=>{ const del=e.target.closest(".del-lift"); if(!del) return; const tr=del.closest("tr"); if(tbody.querySelectorAll("tr").length===1 && !tr.querySelector('[data-field]')) return; tr.remove(); saveExercises(collectExercises()); reindexLog(); initBarbellProgress(); persistCurrentState(); updateHeroMetrics(); window.NutriliftToast&&window.NutriliftToast("Exercise removed"); });
  addBtn?.addEventListener("click",()=>{ if(tbody.querySelector('td[colspan]')) tbody.innerHTML=""; const tr=document.createElement("tr"); tr.setAttribute("data-done","false"); const n=tbody.children.length+1; tr.innerHTML=`<td class="idx mono">${String(n).padStart(2,"0")}</td><td contenteditable="true" data-field="name" spellcheck="false">New Exercise</td><td class="mono" contenteditable="true" data-field="sets" spellcheck="false">3 × 10</td><td class="mono" contenteditable="true" data-field="load" spellcheck="false">20 kg</td><td class="th-check row-actions"><button type="button" class="check-btn" aria-pressed="false" aria-label="Mark New Exercise complete"></button><button type="button" class="del-lift icon-btn" aria-label="Delete exercise" title="Delete">×</button></td>`; tbody.appendChild(tr); saveExercises(collectExercises()); initBarbellProgress(); persistCurrentState(); updateHeroMetrics(); const nameCell=tr.querySelector('[data-field="name"]'); nameCell.focus(); selectAllText(nameCell); });
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
  return d || { protein:0, carbs:0, fats:0, kcal:0 };
}
const MEAL_NUTRIENTS=["protein","carbs","fats","kcal"];
function zeroFuel(){ return {protein:0,carbs:0,fats:0,kcal:0}; }
function getLoggedMealNutrition(entries=[]){
  return entries.reduce((sum,entry)=>{
    const servings=Number(entry.servings)||0, nutrition=entry.nutrition||{};
    MEAL_NUTRIENTS.forEach(key=>{ sum[key]+=Math.round((Number(nutrition[key])||0)*servings); });
    return sum;
  },zeroFuel());
}
function getManualFuel(day={}){
  if(day.fuelManual) return {...zeroFuel(),...day.fuelManual};
  const total={...zeroFuel(),...(day.fuel||{})}, mealFuel=getLoggedMealNutrition(day.meals||[]);
  return Object.fromEntries(MEAL_NUTRIENTS.map(key=>[key,Math.max(0,(Number(total[key])||0)-mealFuel[key])]));
}
function rebuildDayFuel(day={}){
  if(!day.fuelManual) day.fuelManual=getManualFuel(day);
  const manual={...zeroFuel(),...day.fuelManual}, meals=getLoggedMealNutrition(day.meals||[]);
  day.fuel=Object.fromEntries(MEAL_NUTRIENTS.map(key=>[key,(Number(manual[key])||0)+meals[key]]));
  return day.fuel;
}
function saveFuelManualToday(fuel){
  const data=loadStorage(); const k=todayKey();
  if(!data.days) data.days={}; if(!data.days[k]) data.days[k]={ lifts:[], stack:[] };
  data.days[k].fuelManual=fuel; rebuildDayFuel(data.days[k]); pruneOldDays(data); return saveStorage(data);
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
  resetBtn?.addEventListener("click",()=>{ saveFuelManualToday(zeroFuel()); updateFuelUI(getFuelToday()); window.NutriliftToast&&window.NutriliftToast("Manual fuel cleared; logged meals kept"); });
  const presets={ whey:{p:25,c:3,f:2,k:130}, meal:{p:35,c:45,f:15,k:455}, snack:{p:10,c:20,f:8,k:190} };
  form.querySelectorAll("[data-preset]").forEach(b=> b.addEventListener("click",()=>{ const pr=presets[b.dataset.preset]; if(!pr) return; document.getElementById("mProtein").value=pr.p; document.getElementById("mCarbs").value=pr.c; document.getElementById("mFats").value=pr.f; document.getElementById("mKcal").value=pr.k; }));
  form.addEventListener("submit",e=>{
    e.preventDefault();
    let p=parseInt(document.getElementById("mProtein").value)||0, c=parseInt(document.getElementById("mCarbs").value)||0, f=parseInt(document.getElementById("mFats").value)||0, k=parseInt(document.getElementById("mKcal").value)||0;
    const errs=validateMeal(p,c,f,k); showFormError(form,errs); if(errs.length) return;
    if(!k && (p||c||f)) k = p*4 + c*4 + f*9;
    const data=loadStorage(), day=data.days?.[todayKey()]||{}, cur=getManualFuel(day); const next={ protein:Math.min(600,cur.protein+p), carbs:Math.min(800,cur.carbs+c), fats:Math.min(300,cur.fats+f), kcal:Math.min(6000,cur.kcal+k) };
    saveFuelManualToday(next); const total=getFuelToday(); updateFuelUI(total); updateHeroMetrics(); form.reset(); form.hidden=true;
    const btn=form.querySelector('button[type="submit"]'); const orig=btn.textContent; btn.textContent="Saving…"; btn.disabled=true; setTimeout(()=>{ btn.textContent=orig; btn.disabled=false; window.NutriliftToast&&window.NutriliftToast(`+${p}P · +${c}C · +${f}F · +${k} kcal saved`); }, 450);
  });
  // fuel persists to history export automatically via days[date].fuel
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
    else list.innerHTML=defs.map((s,i)=>`<li class="pill-card" data-taken="${dones[i]?"true":"false"}"><div class="pill-label"><span class="pill-name" contenteditable="true" spellcheck="false">${escapeHTML(s.name)}</span><span class="pill-dose mono" contenteditable="true" spellcheck="false">${escapeHTML(s.dose)}</span></div><div style="display:flex; gap:6px; align-items:center;"><button type="button" class="pop-btn" aria-pressed="${dones[i]?"true":"false"}" aria-label="Mark taken"><span class="pop"></span></button><button type="button" class="del-stack icon-btn" aria-label="Delete" title="Delete">×</button></div></li>`).join("");
    updateStackAdherence();
  }
  const collect=()=> Array.from(list.querySelectorAll(".pill-card")).map(li=>({name:li.querySelector(".pill-name")?.textContent.trim()||"",dose:li.querySelector(".pill-dose")?.textContent.trim()||""}));
  list.addEventListener("focusout",e=>{ if(e.target.matches(".pill-name,.pill-dose")){ const v=e.target.textContent.trim(); if(!v){ e.target.textContent=e.target.classList.contains("pill-name")?"Untitled":"—"; window.NutriliftToast&&window.NutriliftToast("Field cannot be empty"); } saveStackDefs(collect()); }});
  list.addEventListener("click",e=>{ const del=e.target.closest(".del-stack"); if(!del) return; del.closest("li").remove(); const remaining=collect(); if(!remaining.length) list.innerHTML=`<li class="mono" style="text-align:center; padding:12px; color:var(--muted); border:1px dashed var(--line); border-radius:8px;">No supplements yet — add one.</li>`; saveStackDefs(remaining); updateStackAdherence(); persistCurrentState(); window.NutriliftToast&&window.NutriliftToast("Supplement removed"); });
  addBtn?.addEventListener("click",()=>{ form.hidden=!form.hidden; if(!form.hidden) document.getElementById("stackName")?.focus(); });
  cancelBtn?.addEventListener("click",()=>{ form.hidden=true; form.reset(); const err=form.querySelector(".form-error"); if(err) err.remove(); });
  form?.addEventListener("submit",e=>{ e.preventDefault(); const n=sanitizeText(document.getElementById("stackName").value,40), d=sanitizeText(document.getElementById("stackDose").value,30)||"—"; const errs=validateStack(n,d); showFormError(form,errs); if(errs.length) return; if(list.querySelector('li mono')||list.querySelector('[style*="dashed"]')) list.innerHTML=""; const li=document.createElement("li"); li.className="pill-card"; li.setAttribute("data-taken","false"); li.innerHTML=`<div class="pill-label"><span class="pill-name" contenteditable="true" spellcheck="false">${escapeHTML(n)}</span><span class="pill-dose mono" contenteditable="true" spellcheck="false">${escapeHTML(d)}</span></div><div style="display:flex; gap:6px; align-items:center;"><button type="button" class="pop-btn" aria-pressed="false" aria-label="Mark taken"><span class="pop"></span></button><button type="button" class="del-stack icon-btn" aria-label="Delete" title="Delete">×</button></div>`; list.appendChild(li); saveStackDefs(collect()); updateStackAdherence(); persistCurrentState(); form.reset(); form.hidden=true; window.NutriliftToast&&window.NutriliftToast("Supplement added"); });
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
    else tbody.innerHTML=prs.map(r=>`<tr><td contenteditable="true" spellcheck="false">${escapeHTML(r.lift)}</td><td class="mono" contenteditable="true" spellcheck="false">${escapeHTML(r.best)}</td><td class="mono th-check" contenteditable="true" spellcheck="false">${escapeHTML(r.date)}</td><td style="text-align:center;"><button type="button" class="del-pr icon-btn" aria-label="Delete">×</button></td></tr>`).join("");
  }
  const collect=()=> Array.from(tbody.querySelectorAll("tr")).filter(tr=>!tr.querySelector("td[colspan]")).map(tr=>{ const tds=tr.querySelectorAll("td"); return {lift:sanitizeText(tds[0]?.textContent,30)||"Untitled",best:sanitizeText(tds[1]?.textContent,20)||"0 kg",date:sanitizeText(tds[2]?.textContent,12)||"—"}; });
  tbody.addEventListener("focusout", e=>{ if(e.target.matches("td[contenteditable]")){ const errs=validatePr(e.target.closest("tr").querySelector("td")?.textContent, e.target.closest("tr").querySelectorAll("td")[1]?.textContent, e.target.closest("tr").querySelectorAll("td")[2]?.textContent); if(errs.length) window.NutriliftToast&&window.NutriliftToast(errs[0]); savePRs(collect()); updateHeroMetrics(); }});
  tbody.addEventListener("click", e=>{ const del=e.target.closest(".del-pr"); if(!del) return; del.closest("tr").remove(); const remaining=collect(); if(!remaining.length) tbody.innerHTML=`<tr><td colspan="4" class="mono" style="text-align:center; padding:12px; color:var(--muted);">No PRs yet — add your first.</td></tr>`; savePRs(remaining.length?remaining:[]); updateHeroMetrics(); window.NutriliftToast&&window.NutriliftToast("PR removed"); });
  addBtn?.addEventListener("click",()=>{ if(tbody.querySelector("td[colspan]")) tbody.innerHTML=""; const tr=document.createElement("tr"); tr.innerHTML=`<td contenteditable="true" spellcheck="false">New Lift</td><td class="mono" contenteditable="true" spellcheck="false">0 kg</td><td class="mono th-check" contenteditable="true" spellcheck="false">AUG 15</td><td style="text-align:center;"><button type="button" class="del-pr icon-btn" aria-label="Delete">×</button></td>`; tbody.appendChild(tr); savePRs(collect()); updateHeroMetrics(); const first=tr.querySelector("td"); first.focus(); selectAllText(first); });
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
  let taken=0, possible=0; Object.values(days).forEach(d=>{ if(d.stack){ taken+=d.stack.filter(Boolean).length; possible+=d.stack.length; }});
  const adh=possible?Math.round(taken/possible*100):0;
  const cols=document.querySelectorAll(".week-chart .day-col"); if(cols.length===7){
    const today=new Date(); const dayIdx=today.getDay(); const monday=new Date(today); monday.setDate(today.getDate()-((dayIdx+6)%7));
    cols.forEach((col,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); const k=dateKeyOf(d); const v=days[k]; const vol=v? (v.lifts?.filter(Boolean).length||0) : 0; col.style.setProperty("--vol", vol); });
    const totalWeek=Array.from(cols).reduce((a,c)=>a+parseInt(c.style.getPropertyValue("--vol")||0),0);
    const ws=document.getElementById("weekSummary"); if(ws) ws.textContent=`${totalWeek?Math.ceil(totalWeek/2):0} sessions · ${adh}% stack adherence`;
  }
  const longest=computeLongestStreak(data); const ls=document.getElementById("insightStreak"); if(ls) ls.textContent=`${longest} days`;
  const adhEl=document.getElementById("insightAdherence"); if(adhEl) adhEl.textContent=adh+"%";
  const volEl=document.getElementById("insightVolume"); if(volEl){
    const now=Object.values(days).slice(-7).reduce((a,d)=>a+(d.lifts?.filter(Boolean).length||0),0);
    const prev=Object.values(days).slice(-14,-7).reduce((a,d)=>a+(d.lifts?.filter(Boolean).length||0),0);
    const pct=prev? Math.round((now-prev)/prev*100) : (now?100:0); volEl.textContent=(pct>0?`+${pct}%`:`${pct}%`);
  }
}

// — Body Weight — one entry per day, 365d retained, 30d trend chart —
const WEIGHT_DAYS_TO_KEEP = 365;
function dateKeyOf(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function monthDayLabel(k){ const p=k.split("-"); return `${MONTHS[parseInt(p[1],10)-1]} ${p[2]}`; }
function validateWeight(v){ const errs=[]; if(Number.isNaN(v)) errs.push("Enter a weight in kg"); else if(v<20||v>400) errs.push("Weight must be 20–400 kg"); return errs; }
function loadBodyweight(){ const d=loadStorage(); return d.bodyweight||{}; }
function pruneOldWeight(data){
  if(!data.bodyweight) return;
  const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-WEIGHT_DAYS_TO_KEEP); const ck=dateKeyOf(cutoff);
  Object.keys(data.bodyweight).forEach(k=>{ if(k<ck) delete data.bodyweight[k]; });
}
function saveBodyweight(map){ const d=loadStorage(); d.bodyweight=map; pruneOldWeight(d); saveStorage(d); }
let weightRangeDays = 30;
function loadWeightGoal(){ const d=loadStorage(); const g=d.weightGoal; return typeof g==="number"?g:null; }
function renderWeightStats(bw=loadBodyweight()){
  const keys=Object.keys(bw).filter(k=>typeof bw[k]==="number").sort(); const lk=keys[keys.length-1];
  const cur=document.getElementById("wCurrent"); if(cur) cur.textContent= lk? `${bw[lk]} kg` : "—";
  const curD=document.getElementById("wCurrentDate"); if(curD) curD.textContent= lk? `${monthDayLabel(lk)} · latest` : "no entries yet";
  const head=document.getElementById("weightHead"); if(head) head.textContent= keys.length? `${keys.length} entr${keys.length===1?"y":"ies"} · 365d kept` : "No entries yet";
  const deltaFor=back=>{ if(!lk) return null; const ref=new Date(); ref.setDate(ref.getDate()-back); const rk=dateKeyOf(ref); let found=null; keys.forEach(k=>{ if(k<=rk) found=k; }); if(!found||found===lk) return null; return bw[lk]-bw[found]; };
  const setD=(id,d)=>{ const el=document.getElementById(id); if(!el) return; if(d===null){ el.textContent="—"; el.classList.remove("flat"); return; } const r=Math.round(d*10)/10; el.textContent=(r>0?`▲ +${r}`:r<0?`▼ ${r}`:"= 0")+" kg"; el.classList.toggle("flat", r===0); };
  setD("wDelta7", deltaFor(7)); setD("wDelta30", deltaFor(30));
  const tv=bw[todayKey()];
  const input=document.getElementById("weightInput");
  if(input && document.activeElement!==input) input.value= tv!==undefined? String(tv) : "";
  const hint=document.getElementById("weightHint");
  if(hint) hint.textContent= tv!==undefined? `Today logged: ${tv} kg — saving again updates it.` : (lk? `Last entry: ${bw[lk]} kg on ${monthDayLabel(lk)}.` : "First weigh-in? Log it above — one entry per day.");
}
function renderWeightChart(bw=loadBodyweight()){
  const wrap=document.getElementById("weightChartWrap"), svg=document.getElementById("weightChart"); if(!wrap||!svg) return;
  const today=new Date(), range=weightRangeDays, pts=[];
  for(let i=range-1;i>=0;i--){ const d=new Date(today); d.setDate(today.getDate()-i); const k=dateKeyOf(d); const v=bw[k]; if(typeof v==="number") pts.push({t:d.getTime(),v,k}); }
  const startD=new Date(today); startD.setDate(startD.getDate()-(range-1));
  const w=Math.max(260, wrap.clientWidth||600), h=172, padX=16, padTop=20, padBot=16, base=h-padBot;
  svg.setAttribute("viewBox",`0 0 ${w} ${h}`);
  svg.setAttribute("aria-label",`Body weight trend, last ${range} days`);
  const start=startD.getTime(), span=Math.max(1, today.getTime()-start);
  const X=t=> padX + (t-start)/span*(w-2*padX);
  let g="";
  [padTop,(padTop+base)/2,base].forEach(y=>{ g+=`<line class="wc-grid" x1="${padX}" y1="${y.toFixed(1)}" x2="${w-padX}" y2="${y.toFixed(1)}"/>`; });
  if(!pts.length){
    g+=`<text class="wc-empty" x="${(w/2).toFixed(1)}" y="${((base+padTop)/2).toFixed(1)}">No weigh-ins in the last ${range} days — log one above</text>`;
  } else {
    const vs=pts.map(p=>p.v); let lo=Math.min(...vs), hi=Math.max(...vs);
    const goal=loadWeightGoal(), showGoal=goal!==null && goal>=lo-12 && goal<=hi+12;
    if(showGoal){ lo=Math.min(lo,goal); hi=Math.max(hi,goal); }
    if(hi-lo<2){ const mid=(hi+lo)/2; lo=mid-1; hi=mid+1; } else { lo-=0.3; hi+=0.3; }
    const Y=v=> padTop + (hi-v)/(hi-lo)*(base-padTop);
    g+=`<text class="wc-label" x="${w-padX}" y="${(Y(hi)+11).toFixed(1)}" text-anchor="end">${hi.toFixed(1)} kg</text>`;
    g+=`<text class="wc-label" x="${w-padX}" y="${(Y(lo)-5).toFixed(1)}" text-anchor="end">${lo.toFixed(1)} kg</text>`;
    if(showGoal){
      g+=`<line class="wc-goal" x1="${padX}" y1="${Y(goal).toFixed(1)}" x2="${w-padX}" y2="${Y(goal).toFixed(1)}"/>`;
      g+=`<text class="wc-goal-label" x="${padX+2}" y="${(Y(goal)-5).toFixed(1)}">GOAL ${goal.toFixed(1)}</text>`;
    }
    const cs=pts.map(p=>[X(p.t),Y(p.v)]);
    if(cs.length>1){
      g+=`<defs><linearGradient id="wgArea" x1="0" y1="0" x2="0" y2="1"><stop class="wg-top" offset="0"/><stop class="wg-bot" offset="1"/></linearGradient></defs>`;
      g+=`<path class="wc-area" d="M ${cs[0][0].toFixed(1)},${base} L ${cs.map(c=>`${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" L ")} L ${cs[cs.length-1][0].toFixed(1)},${base} Z"/>`;
      g+=`<polyline class="wc-line" points="${cs.map(c=>`${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ")}"/>`;
      const trend=pts.map((p,i)=>{ let sum=0,n=0; for(let j=i;j>=0 && p.t-pts[j].t<=7*864e5;j--){ sum+=pts[j].v; n++; } return [X(p.t),Y(sum/n)]; });
      g+=`<polyline class="wc-trend" points="${trend.map(c=>`${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ")}"/>`;
    }
    cs.forEach((c,i)=>{ const k=escapeHTML(pts[i].k), v=pts[i].v, last=i===cs.length-1; const x=c[0].toFixed(1), y=c[1].toFixed(1);
      g+=`<circle class="wc-hit" cx="${x}" cy="${y}" r="10" data-date="${k}"/>`;
      g+=`<circle class="${last?"wc-today":"wc-dot"}" cx="${x}" cy="${y}" r="${last?4.2:2.8}" data-date="${k}"><title>${k} — ${v} kg</title></circle>`;
    });
  }
  svg.innerHTML=g;
  const rs=document.getElementById("wRangeStart"); if(rs) rs.textContent= pts.length? monthDayLabel(pts[0].k) : "—";
  const re=document.getElementById("wRangeEnd"); if(re) re.textContent= pts.length? monthDayLabel(todayKey()) : "—";
  const rm=document.getElementById("wRangeMeta"); if(rm) rm.textContent=`LAST ${range} DAYS · ${pts.length} ENTR${pts.length===1?"Y":"IES"}`;
}
function initBodyWeight(){
  const panel=document.getElementById("weightPanel"); if(!panel) return;
  const form=document.getElementById("weightForm"), input=document.getElementById("weightInput"), goalInput=document.getElementById("weightGoal"), resetBtn=document.getElementById("resetWeightBtn"), chart=document.getElementById("weightChart");
  weightRangeDays = loadStorage().weightRange===90 ? 90 : 30;
  const syncRange=()=> panel.querySelectorAll("[data-range]").forEach(b=>{ const on=parseInt(b.dataset.range,10)===weightRangeDays; b.classList.toggle("active",on); b.setAttribute("aria-pressed",String(on)); });
  const refresh=()=>{ const bw=loadBodyweight(); renderWeightStats(bw); renderWeightChart(bw); };
  syncRange(); refresh();
  const goal=loadWeightGoal(); if(goalInput && goal!==null) goalInput.value=String(goal);
  let rz=null; window.addEventListener("resize",()=>{ clearTimeout(rz); rz=setTimeout(()=>renderWeightChart(),150); });
  panel.querySelectorAll("[data-range]").forEach(b=> b.addEventListener("click",()=>{
    const r=parseInt(b.dataset.range,10); if(r===weightRangeDays) return;
    weightRangeDays=r; const d=loadStorage(); d.weightRange=r; saveStorage(d); syncRange(); renderWeightChart();
  }));
  goalInput?.addEventListener("change",()=>{
    const raw=goalInput.value.trim(), d=loadStorage();
    if(!raw){ showFormError(form,[]); delete d.weightGoal; saveStorage(d); renderWeightChart(); window.NutriliftToast&&window.NutriliftToast("Goal weight cleared"); return; }
    const v=parseFloat(raw), errs=validateWeight(v); showFormError(form,errs); if(errs.length) return;
    d.weightGoal=Math.round(v*10)/10; saveStorage(d); goalInput.value=String(d.weightGoal); renderWeightChart();
    window.NutriliftToast&&window.NutriliftToast(`Goal set: ${d.weightGoal} kg`);
  });
  chart?.addEventListener("click",e=>{
    const dot=e.target.closest("[data-date]"); if(!dot) return;
    const k=dot.getAttribute("data-date"), bw=loadBodyweight(); if(bw[k]===undefined) return;
    if(!confirm(`Delete weight entry for ${k} (${bw[k]} kg)?`)) return;
    delete bw[k]; saveBodyweight(bw); refresh();
    window.NutriliftToast&&window.NutriliftToast(`Weight entry for ${k} removed`);
  });
  form?.addEventListener("submit",e=>{
    e.preventDefault();
    const v=parseFloat(input?.value); const errs=validateWeight(v); showFormError(form,errs);
    if(errs.length){ input?.focus(); return; }
    const kg=Math.round(v*10)/10; const bw=loadBodyweight(); const prev=bw[todayKey()];
    bw[todayKey()]=kg; saveBodyweight(bw); refresh();
    window.NutriliftToast&&window.NutriliftToast(prev!==undefined? `Today's weight updated: ${kg} kg` : `Weight logged: ${kg} kg`);
  });
  resetBtn?.addEventListener("click",()=>{
    const bw=loadBodyweight(); if(!Object.keys(bw).length){ window.NutriliftToast&&window.NutriliftToast("No entries to reset"); return; }
    if(!confirm("Delete all body weight entries? This cannot be undone.")) return;
    const d=loadStorage(); delete d.bodyweight; saveStorage(d); refresh();
    window.NutriliftToast&&window.NutriliftToast("Body weight log cleared");
  });
}

// — Reveal — clean fade + slight rise only
function initReveal() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;
  const els = document.querySelectorAll(".hero, .method, .panel, .insights, .programs-teaser, .pricing, .faq, .cta-banner, .programs-hero");
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

// — Directional bow + archery minigame — smooth lerp, dblclick shoots, triple-click spawns board; miss = 404 —
function initBowShoot(){
  if(window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bow=document.createElement('div'); bow.id='bowCursor'; bow.setAttribute('aria-hidden','true');
  bow.innerHTML=`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='34' height='34'><path d='M9 3 Q22 16 9 29' stroke='#C81E3D' stroke-width='2.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/><line x1='9' y1='6' x2='9' y2='26' stroke='#211714' stroke-width='0.9' opacity='0.18' stroke-dasharray='2 2'/><g transform='translate(9 14)'><line x1='0' y1='2' x2='15' y2='2' stroke='#5B4C47' stroke-width='1.5' stroke-linecap='round'/><path d='M15 2 L11 0 L11 4 Z' fill='#211714' stroke='#211714' stroke-width='0.6' stroke-linejoin='round'/><path d='M0 0 L3 2 L0 4' fill='none' stroke='#9A8A83' stroke-width='1.1' opacity='0.9' stroke-linecap='round' stroke-linejoin='round'/></g></svg>`;
  document.body.appendChild(bow); document.documentElement.classList.add('bow-active');
  // smooth-follow state — lerped every frame in rAF loop (no CSS transition, no jitter)
  let tx=innerWidth/2, ty=innerHeight/2, px=tx, py=ty;
  let lastX=tx, lastY=ty, tAngle=0, angle=0, tShoot=0, shootAngle=0, recoil=1;
  const norm=a=>{ while(a>180)a-=360; while(a<=-180)a+=360; return a; };
  // rAF runs only until the cursor settles — idle pages cost zero frames
  let rafId=0, running=false;
  const settled=()=> Math.abs(tx-px)<0.3 && Math.abs(ty-py)<0.3 && Math.abs(norm(tAngle-angle))<0.3 && Math.abs(1-recoil)<0.01;
  const bowLoop=()=>{
    px+=(tx-px)*0.35; py+=(ty-py)*0.35;
    angle+=norm(tAngle-angle)*0.3;
    recoil+=(1-recoil)*0.2;
    bow.style.left=px+'px'; bow.style.top=py+'px';
    bow.style.transform=`translate(-50%,-50%) rotate(${angle.toFixed(2)}deg) scale(${recoil.toFixed(3)})`;
    if(settled()){ running=false; rafId=0; return; }
    rafId=requestAnimationFrame(bowLoop);
  };
  const startBow=()=>{ if(!running){ running=true; rafId=requestAnimationFrame(bowLoop); } };
  const stopBow=()=>{ if(rafId) cancelAnimationFrame(rafId); rafId=0; running=false; };
  startBow();
  document.addEventListener('mousemove', e=>{
    const dx=e.clientX-lastX, dy=e.clientY-lastY;
    if(Math.hypot(dx,dy)>1.5){ const mv=Math.atan2(dy,dx)*180/Math.PI; tShoot=norm(mv+180); shootAngle=tShoot; tAngle=shootAngle; }
    tx=e.clientX; ty=e.clientY; lastX=e.clientX; lastY=e.clientY; bow.classList.add('show'); startBow();
  }, {passive:true});
  document.addEventListener('mouseleave', ()=>{ bow.classList.remove('show'); stopBow(); });
  document.addEventListener('mouseenter', ()=>{ bow.classList.add('show'); startBow(); });
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) stopBow(); else startBow(); });
  // archery board — dblclick spawns it on the predicted flight path (same physics as the shot)
  const V=16, GRAV=0.22, BOARD_R=60;
  let board=null, flying=false, cooldownUntil=0;
  const predict=(sx,sy,ang,n)=>{ const r=ang*Math.PI/180; const vx=Math.cos(r)*V; let x=sx, y=sy, vy=Math.sin(r)*V; for(let i=0;i<n;i++){ x+=vx; y+=vy; vy+=GRAV; } return {x,y}; };
  const fits=(x,y,m)=> x>m && x<innerWidth-m && y>m && y<innerHeight-m;
  // double-click shoots — delayed 350ms so a triple-click can steal it to spawn a board instead
  let pendingDouble=null;
  document.addEventListener('dblclick', e=>{
    if(e.target.closest('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
    clearTimeout(pendingDouble);
    pendingDouble=setTimeout(()=>{ pendingDouble=null; fireArrow(); }, 350);
  });
  // triple-click spawns the board (cancels any pending double-click shot)
  document.addEventListener('click', e=>{
    if(e.detail!==3) return;
    if(e.target.closest('input, textarea, [contenteditable="true"], button, a, [role="button"]')) return;
    clearTimeout(pendingDouble); pendingDouble=null;
    e.preventDefault();
    if(board) board.el.remove();
    let spot=null;
    for(let n=26;n>=10;n--){ const p=predict(tx,ty,shootAngle,n); if(fits(p.x,p.y,80)){ spot=p; break; } }
    if(!spot){ window.NutriliftToast&&window.NutriliftToast("No range here — aim from open space 🎯"); return; }
    const bel=document.createElement('div'); bel.className='archery-board'; bel.setAttribute('aria-hidden','true');
    bel.style.left=spot.x+'px'; bel.style.top=spot.y+'px';
    document.body.appendChild(bel);
    board={el:bel, cx:spot.x, cy:spot.y, r:BOARD_R};
    cooldownUntil=Date.now()+600;
    window.NutriliftToast&&window.NutriliftToast("Target up — double-click to shoot. Miss = 404 😬");
  });
  // arrow shot — fired by the delayed double-click; board target if active, else button hit
  const fireArrow=()=>{
    if(Date.now()<cooldownUntil || flying) return;
    const startX=px, startY=py, ang=shootAngle;
    const el=document.createElement('div'); el.className='shot-arrow';
    el.innerHTML=`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 12' width='28' height='12'><line x1='2' y1='6' x2='20' y2='6' stroke='#211714' stroke-width='1.6' stroke-linecap='round'/><path d='M20 6 L14 2 L14 10 Z' fill='#C81E3D' stroke='#8F2438' stroke-width='0.7' stroke-linejoin='round'/><path d='M2 3 L6 6 L2 9' fill='none' stroke='#9A8A83' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
    el.style.left=(startX-14)+'px'; el.style.top=(startY-7)+'px'; el.style.transform=`rotate(${ang}deg)`; el.style.opacity='1';
    document.body.appendChild(el);
    flying=true; recoil=0.85; startBow();
    // physics: velocity + gravity (same constants the board was placed with)
    const rad=ang*Math.PI/180; let vx=Math.cos(rad)*V, vy=Math.sin(rad)*V, ax=startX, ay=startY;
    const btns= board ? [] : Array.from(document.querySelectorAll('button, a.btn, [role="button"]')).filter(b=> !b.closest('#bowCursor') && b.offsetParent!==null && !b.disabled);
    let hit=null, raf=null, done=false;
    const finish=()=>{ done=true; flying=false; };
    const miss=()=>{
      if(done) return; finish();
      el.style.opacity='0'; setTimeout(()=> el.remove(), 200);
      if(board){ const b=board; board=null; b.el.remove(); window.location.href='404.html?missed=1'; }
    };
    const hitBoard=()=>{
      if(done) return; finish();
      const b=board; board=null;
      b.el.classList.add('board-hit');
      try{ const s=JSON.parse(localStorage.getItem('nutrilift:v1')||'{}'); s.archeryHits=(s.archeryHits||0)+1; localStorage.setItem('nutrilift:v1',JSON.stringify(s)); window.NutriliftToast&&window.NutriliftToast(`🎯 BULLSEYE — ${s.archeryHits} total`); }
      catch(err){ window.NutriliftToast&&window.NutriliftToast('🎯 BULLSEYE'); }
      el.style.opacity='0'; setTimeout(()=> el.remove(), 250);
      setTimeout(()=> b.el.remove(), 550);
    };
    const step=()=>{
      if(done) return;
      ax+=vx; ay+=vy; vy+=GRAV;
      const curAng=Math.atan2(vy,vx)*180/Math.PI;
      el.style.left=(ax-14)+'px'; el.style.top=(ay-7)+'px'; el.style.transform=`rotate(${curAng}deg)`;
      // bounds check
      if(ax<-40||ax>innerWidth+40||ay>innerHeight+40){ miss(); return; }
      if(board){
        const tipX=ax+14*Math.cos(curAng*Math.PI/180), tipY=ay+14*Math.sin(curAng*Math.PI/180);
        if(Math.hypot(tipX-board.cx, tipY-board.cy)<=board.r){ hitBoard(); return; }
      } else {
        // hit test: arrow tip vs buttons
        const tipX=ax+14*Math.cos(curAng*Math.PI/180), tipY=ay+Math.sin(curAng*Math.PI/180)*7;
        for(const b of btns){
          const r=b.getBoundingClientRect();
          if(tipX>=r.left && tipX<=r.right && tipY>=r.top && tipY<=r.bottom){ hit=b; break; }
        }
        if(hit){
          hit.classList.add('arrow-hit'); setTimeout(()=> hit.classList.remove('arrow-hit'), 400);
          hit.click();
          window.NutriliftToast&&window.NutriliftToast(`Hit — ${hit.textContent.trim().slice(0,22)} clicked`);
          el.style.transform=`rotate(${curAng}deg) scale(1.15)`; el.style.opacity='0';
          setTimeout(()=> el.remove(), 220);
          finish(); return;
        }
      }
      raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
    setTimeout(()=>{ if(!done) miss(); }, 2000);
  };
}
// — Beast mode easter egg — type BEAST or Konami code, persisted —
function initBeastMode(){
  const KEY="beast";
  try{ if(loadStorage()[KEY]) document.body.classList.add("beast-mode"); }catch(e){}
  const KONAMI=["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];
  let buf=[];
  const toggle=(on)=>{
    document.body.classList.toggle("beast-mode", on);
    try{ const d=loadStorage(); d[KEY]=on; saveStorage(d); }catch(e){}
    window.NutriliftToast&&window.NutriliftToast(on?"🔥 BEAST MODE ENGAGED — type BEAST again to chill":"Beast mode off — back to calm");
  };
  document.addEventListener("keydown", e=>{
    if(e.target.matches("input, textarea, [contenteditable='true']")) return;
    const k=e.key.toLowerCase();
    buf.push(k); if(buf.length>10) buf.shift();
    const word=buf.join("");
    const konami=KONAMI.every((v,i)=> buf[buf.length-KONAMI.length+i]===v);
    if(word.slice(-5)==="beast" || konami){
      buf=[];
      e.stopImmediatePropagation();
      e.preventDefault();
      toggle(!document.body.classList.contains("beast-mode"));
    }
  }, { capture:true });
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
    else if(href==="meals.html" && path==="meals.html") a.classList.add("active");
    else if(href==="meal-plans.html" && path==="meal-plans.html") a.classList.add("active");
    else if(href==="history.html" && path==="history.html") a.classList.add("active");
    else if(href==="showcase.html" && path==="showcase.html") a.classList.add("active");
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
      setTimeout(()=>{ btn.textContent="Get recap"; btn.disabled=false; input.value="";
        try{ const s=loadStorage(); s.emails=s.emails||[]; s.emails.push({email:v, at:new Date().toISOString()}); saveStorage(s); window.NutriliftToast&&window.NutriliftToast("You’re on the list — check your inbox."); }
        catch(e){ window.NutriliftToast&&window.NutriliftToast("Couldn’t save email — storage unavailable"); }
      }, 600);
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
  // message queued before a reload (e.g. CSV import) — show it once after load
  try {
    const flash = sessionStorage.getItem("nutrilift:flash");
    if (flash) { sessionStorage.removeItem("nutrilift:flash"); show(flash); }
  } catch (e) {}
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toast]");
    if (!btn) return;
    const msg = btn.getAttribute("data-toast");
    if (msg) show(msg);
  });
  // inline forms fallback already call window.NutriliftToast directly
}

function flashToast(msg) {
  try { sessionStorage.setItem("nutrilift:flash", msg); } catch (e) {}
}

// — History page — 90d calendar + export (verified 90 days inclusive) —
function initHistoryPage(){
  const cal=document.getElementById("historyCal"); if(!cal) return;
  const data=loadStorage();
  // prune on load so calendar never shows >90d ghost data
  const beforeCount=Object.keys(data.days||{}).length+Object.keys(data.bodyweight||{}).length; pruneOldDays(data); pruneOldWeight(data); if(Object.keys(data.days||{}).length+Object.keys(data.bodyweight||{}).length!==beforeCount) saveStorage(data);
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
    breakdown.innerHTML=`<div class="recent-row"><span>Lifts logged</span><span class="mono">${Object.values(days).reduce((a,d)=>a+(d.lifts?.filter(Boolean).length||0),0)}</span></div><div class="recent-row"><span>Stack taken</span><span class="mono">${taken}/${possible}</span></div><div class="recent-row"><span>Avg kcal</span><span class="mono">${avgKcal} kcal</span></div><div class="recent-row"><span>Best streak</span><span class="mono">${computeLongestStreak(data)} days</span></div>`;
  }
  const detail=document.getElementById("dayDetail"); const bw=data.bodyweight||{}; cal.addEventListener("click",e=>{ const b=e.target.closest(".cal-day"); if(!b||!detail) return; const k=b.dataset.k; const v=days[k]; const f=v?.fuel; const wgt=bw[k]; detail.style.display="block"; detail.innerHTML=v||wgt?`<strong class="mono">${k}</strong> — ${(v?.lifts?.filter(Boolean).length||0)} lifts · ${(v?.stack?.filter(Boolean).length||0)} stack${f?` · ${f.kcal} kcal (${f.protein}P ${f.carbs}C ${f.fats}F)`:""}${wgt?` · ${wgt} kg`:""}`:`<span class="mono">${k}: no data</span>`; });
  const doExport=()=>{ const rows=[["date","lifts_done","stack_done","protein","carbs","fats","kcal","weight_kg"]]; Object.keys(days).sort().forEach(k=>{ const d=days[k]; const f=d.fuel||{protein:0,carbs:0,fats:0,kcal:0}; rows.push([k, (d.lifts?.filter(Boolean).length||0), (d.stack?.filter(Boolean).length||0), f.protein, f.carbs, f.fats, f.kcal, bw[k]??""]); }); const csv=rows.map(r=>r.join(",")).join("\n"); const blob=new Blob([csv],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="nutrilift-history.csv"; a.click(); window.NutriliftToast&&window.NutriliftToast("CSV with fuel + weight downloaded"); };
  const doClear=()=>{ if(!confirm("Clear 90-day history?")) return; data.days={}; saveStorage(data); location.reload(); };
  ["exportBtn","footerExport"].forEach(id=>{ const e=document.getElementById(id); if(e) e.addEventListener("click",e=>{e.preventDefault(); doExport();}); });
  ["clearBtn","footerClear"].forEach(id=>{ const e=document.getElementById(id); if(e) e.addEventListener("click",e=>{e.preventDefault(); doClear();}); });
}

// — CSV import — mirrors Export CSV; merges day counts, fuel and weigh-ins —
const CSV_COLUMN_ALIASES = {
  date: "date", day: "date",
  lifts_done: "lifts", lifts: "lifts",
  stack_done: "stack", stack: "stack",
  protein: "protein", protein_g: "protein",
  carbs: "carbs", carbs_g: "carbs",
  fats: "fats", fat: "fats", fats_g: "fats",
  kcal: "kcal", calories: "kcal",
  weight_kg: "weight", weight: "weight"
};

// RFC-4180-ish parser: quoted fields, escaped quotes, CRLF/LF, BOM, blank lines
function parseCSV(text) {
  const rows = []; let row = [], field = "", inQuotes = false;
  const s = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = ""; rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}

function csvColumnMap(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => {
    const key = String(h).trim().toLowerCase().replace(/[\s-]+/g, "_");
    const col = CSV_COLUMN_ALIASES[key];
    if (col && map[col] === undefined) map[col] = i;
  });
  return map;
}

function parseISODateKey(k) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return null;
  const [y, m, d] = k.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

function csvNumber(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/[,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// Mutates `data` in memory (caller prunes + saves). Never lowers existing counts.
function importHistoryCSV(text, data) {
  const rows = parseCSV(text);
  const summary = { days: 0, weights: 0, skipped: 0, older: 0, total: 0 };
  if (rows.length < 2) return { summary, error: "CSV needs a header row and at least one data row" };
  const map = csvColumnMap(rows[0]);
  if (map.date === undefined) return { summary, error: "No date column found — export a CSV from this page to see the format" };

  const today = todayKey();
  const dayCut = new Date(); dayCut.setDate(dayCut.getDate() - DAYS_TO_KEEP);
  const dayCutKey = dateKeyOf(dayCut);
  const weightCut = new Date(); weightCut.setDate(weightCut.getDate() - WEIGHT_DAYS_TO_KEEP);
  const weightCutKey = dateKeyOf(weightCut);
  const exLen = Math.max(1, loadExercises().length);
  const stackLen = Math.max(1, loadStackDefs().length);
  if (!data.days) data.days = {};
  if (!data.bodyweight) data.bodyweight = {};

  const cell = (row, col) => col === undefined ? undefined : row[col];
  const clamp = (n, max) => n === null ? 0 : Math.min(max, Math.max(0, Math.round(n)));

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; summary.total++;
    const raw = String(cell(row, map.date) || "").trim();
    if (!parseISODateKey(raw) || raw > today) { summary.skipped++; continue; }

    const liftsN = csvNumber(cell(row, map.lifts));
    const stackN = csvNumber(cell(row, map.stack));
    const p = csvNumber(cell(row, map.protein));
    const c = csvNumber(cell(row, map.carbs));
    const f = csvNumber(cell(row, map.fats));
    const k = csvNumber(cell(row, map.kcal));
    const w = csvNumber(cell(row, map.weight));
    if ([liftsN, stackN, p, c, f, k, w].some(n => Number.isNaN(n))) { summary.skipped++; continue; }

    const dayInWindow = raw >= dayCutKey;
    const weightInWindow = raw >= weightCutKey;
    const liftsDone = clamp(liftsN, exLen);
    const stackDone = clamp(stackN, stackLen);
    const fuelVals = { protein: clamp(p, 300), carbs: clamp(c, 800), fats: clamp(f, 300), kcal: clamp(k, 6000) };
    const hasFuel = Object.values(fuelVals).some(v => v > 0);
    let didDay = false, didWeight = false;

    if (dayInWindow && (liftsDone > 0 || stackDone > 0 || hasFuel || data.days[raw])) {
      const prev = data.days[raw] || {};
      const prevLifts = Array.isArray(prev.lifts) ? prev.lifts : [];
      const prevStack = Array.isArray(prev.stack) ? prev.stack : [];
      const mergedLifts = Math.min(Math.max(prevLifts.length, exLen), Math.max(prevLifts.filter(Boolean).length, liftsDone));
      const mergedStack = Math.min(Math.max(prevStack.length, stackLen), Math.max(prevStack.filter(Boolean).length, stackDone));
      const next = { ...prev };
      if (mergedLifts > 0 || prev.lifts) next.lifts = Array.from({ length: Math.max(prevLifts.length, exLen, mergedLifts) }, (_, i) => i < mergedLifts);
      if (mergedStack > 0 || prev.stack) next.stack = Array.from({ length: Math.max(prevStack.length, stackLen, mergedStack) }, (_, i) => i < mergedStack);
      if (hasFuel) {
        next.fuel = { ...fuelVals, ...(prev.fuel || {}) };
        ["protein", "carbs", "fats", "kcal"].forEach(key => { if (fuelVals[key] > 0) next.fuel[key] = fuelVals[key]; });
        const loggedMeals = getLoggedMealNutrition(next.meals || []);
        next.fuelManual = Object.fromEntries(MEAL_NUTRIENTS.map(key => [key, Math.max(0, (Number(next.fuel[key]) || 0) - loggedMeals[key])]));
      }
      data.days[raw] = next;
      didDay = true;
      summary.days++;
    }

    if (w !== null && w >= 20 && w <= 400 && weightInWindow) {
      data.bodyweight[raw] = Math.round(w * 10) / 10;
      didWeight = true;
      summary.weights++;
    }

    if (!didDay && !didWeight) {
      const hasWeight = w !== null;
      const outside = hasWeight ? (!dayInWindow && !weightInWindow) : !dayInWindow;
      if (outside) summary.older++; else summary.skipped++;
    }
  }
  return { summary };
}

function initHistoryImport() {
  const input = document.getElementById("importFile");
  if (!input) return;
  const triggers = ["importBtn", "footerImport"].map(id => document.getElementById(id)).filter(Boolean);
  triggers.forEach(btn => btn.addEventListener("click", e => {
    e.preventDefault();
    input.value = "";
    input.click();
  }));
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      window.NutriliftToast && window.NutriliftToast("CSV too large — keep it under 1 MB");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = loadStorage();
      const result = importHistoryCSV(String(reader.result || ""), data);
      if (result.error) {
        window.NutriliftToast && window.NutriliftToast(result.error);
        return;
      }
      const s = result.summary;
      if (!s.days && !s.weights) {
        window.NutriliftToast && window.NutriliftToast("No importable rows found — check dates and values");
        return;
      }
      const lines = [
        `Import ${s.days} day${s.days === 1 ? "" : "s"} and ${s.weights} weigh-in${s.weights === 1 ? "" : "s"}?`,
        "",
        "Existing logs are merged — counts never go down."
      ];
      if (s.skipped) lines.push(`${s.skipped} row${s.skipped === 1 ? "" : "s"} skipped (bad date or value).`);
      if (s.older) lines.push(`${s.older} row${s.older === 1 ? "" : "s"} outside the 90-day / 365-day window.`);
      if (!confirm(lines.join("\n"))) return;

      pruneOldDays(data);
      pruneOldWeight(data);
      saveStorage(data);
      const parts = [];
      if (s.days) parts.push(`${s.days} day${s.days === 1 ? "" : "s"}`);
      if (s.weights) parts.push(`${s.weights} weigh-in${s.weights === 1 ? "" : "s"}`);
      flashToast(`Imported ${parts.join(" + ")}`);
      location.reload();
    };
    reader.onerror = () => window.NutriliftToast && window.NutriliftToast("Could not read that file");
    reader.readAsText(file);
  });
}

// — Showcase — single source of truth (edit here, page updates; no hardcoded duplicates) —
const SHOWCASE_DATA = {
  hero: { eyebrow: "NUTRILIFT PRO — CINEMATIC TOUR · RED + BLACK", titleA: "STRENGTH,", titleB: "IN DEPTH.", sub: "One object. Three chapters. Scroll — the plate rotates, scales and lights up as each pillar comes into focus." },
  features: [
    { icon: "◈", title: "Session engine", body: "Editable lifts, Push / Pull / Legs switch, barbell that loads live.", meta: "LOCAL · INSTANT" },
    { icon: "⬢", title: "Stack ritual", body: "One-tap adherence with AM / Pre / Post / PM timing.", meta: "90-DAY CURVE" },
    { icon: "⬣", title: "Fuel bars", body: "Protein, carbs, fats, kcal with presets and over-target glow.", meta: "PRESETS · CSV" },
    { icon: "◉", title: "90-day proof", body: "Calendar, recent logs and breakdown — all exportable.", meta: "HISTORY PAGE" },
    { icon: "⬔", title: "Programs", body: "Six splits with filters and detail modal. Set one active.", meta: "6 SPLITS" },
    { icon: "✦", title: "Private by design", body: "No account, no cloud. Everything stays in this browser.", meta: "LOCALSTORAGE" }
  ]
};
// Apple-style scroll story: sticky canvas + rAF scroll progress → 3D transform (transform/opacity only)
function initShowcase(){
  const story=document.getElementById("showStory"); if(!story) return;
  const obj=document.getElementById("showObject"), glowA=document.getElementById("showGlowA"), glowB=document.getElementById("showGlowB"), bar=document.getElementById("showProgress");
  const steps=Array.from(story.querySelectorAll(".show-step"));
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // 1) content from single source (easy to change later)
  try{
    const hb=document.getElementById("showHeroEyebrow"); if(hb) hb.textContent=SHOWCASE_DATA.hero.eyebrow;
    const ht=document.getElementById("showHeroTitle"); if(ht) ht.innerHTML=escapeHTML(SHOWCASE_DATA.hero.titleA)+"<br><span>"+escapeHTML(SHOWCASE_DATA.hero.titleB)+"</span>";
    const hs=document.getElementById("showHeroSub"); if(hs) hs.textContent=SHOWCASE_DATA.hero.sub;
    const grid=document.getElementById("showFeatures");
    if(grid){ grid.innerHTML=SHOWCASE_DATA.features.map(f=>`<article class="show-feature-card"><div class="show-feature-icon">${escapeHTML(f.icon)}</div><h3>${escapeHTML(f.title)}</h3><p>${escapeHTML(f.body)}</p><span class="mono">${escapeHTML(f.meta)}</span></article>`).join(""); }
  }catch(e){ console.error("Showcase content failed", e); }
  // 2.5) title scramble intro + hero parallax (transform/opacity only)
  const hero=document.querySelector(".show-hero"), heroTitle=document.getElementById("showHeroTitle");
  if(heroTitle && !reduced){
    const html=heroTitle.innerHTML;
    const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ#/\\%&*";
    const target="STRENGTH, IN DEPTH.";
    let f=0, frames=16, iv=setInterval(()=>{
      f++;
      if(f>=frames){ heroTitle.innerHTML=html; clearInterval(iv); return; }
      let out="";
      for(let i=0;i<target.length;i++){
        if(target[i]===" ") out+=" ";
        else out += (f/frames>Math.random()*1.4)? target[i] : chars[(Math.random()*chars.length)|0];
      }
      heroTitle.textContent=out;
    }, 42);
    window.addEventListener("pagehide", ()=>clearInterval(iv), { once:true });
  }
  if(hero && heroTitle && !reduced){
    let hTick=false;
    const hFrame=()=>{
      hTick=false;
      const y=Math.min(1, window.scrollY/window.innerHeight);
      heroTitle.style.transform=`translateY(${(y*70).toFixed(1)}px)`;
      heroTitle.style.opacity=(1-y*1.2).toFixed(2);
      const sub=document.getElementById("showHeroSub"); if(sub) sub.style.opacity=(1-y*1.6).toFixed(2);
    };
    const hScroll=()=>{ if(!hTick){ hTick=true; requestAnimationFrame(hFrame); } };
    window.addEventListener("scroll", hScroll, { passive:true });
    window.addEventListener("pagehide", ()=>window.removeEventListener("scroll", hScroll), { once:true });
  }
  try{
    const data=loadStorage(), days=data.days||{};
    let taken=0, possible=0; Object.values(days).forEach(d=>{ if(d.stack){ taken+=d.stack.filter(Boolean).length; possible+=d.stack.length; }});
    const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
    set("showStatStreak", computeStreak(data)+" days");
    set("showStatSessions", Object.keys(days).length+" logged");
    set("showStatAdherence", (possible?Math.round(taken/possible*100):0)+"%");
  }catch(e){ console.error("Showcase stats failed", e); }
  if(reduced){ steps.forEach(s=> s.classList.add("is-visible")); if(bar) bar.style.width="100%"; return; }
  // 3) step reveals (IntersectionObserver, no scroll jank)
  let io=null;
  try{
    io=new IntersectionObserver(entries=>{
      entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add("is-visible"); } });
    }, { rootMargin:"-38% 0px -38% 0px", threshold:0.1 });
    steps.forEach(s=> io.observe(s));
  }catch(e){ steps.forEach(s=> s.classList.add("is-visible")); }
  // 4) scroll progress → 3D (single rAF-throttled listener, transform/opacity only)
  let ticking=false, rafId=0;
  const isMobile=()=> window.innerWidth<860 || window.matchMedia("(pointer: coarse)").matches;
  const render=()=>{
    ticking=false;
    if(!story.isConnected){ cleanup(); return; }
    const rect=story.getBoundingClientRect();
    const total=Math.max(1, story.offsetHeight - window.innerHeight);
    const p=Math.min(1, Math.max(0, -rect.top/total));
    if(bar) bar.style.width=(p*100).toFixed(1)+"%";
    if(obj){
      const m=isMobile();
      const ry=(p*380).toFixed(1), rx=(12-p*26).toFixed(1);
      const s=(m? 0.9+p*0.25 : 1+p*0.42).toFixed(3);
      const tx=((p-0.5)*(m?24:70)).toFixed(1), ty=(-p*(m?10:26)).toFixed(1);
      obj.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg) scale(${s}) translate3d(${tx}px, ${ty}px, 0)`;
    }
    if(glowA) glowA.style.transform=`translate(${(p-0.5)*60}px, ${-p*40}px) scale(${1+p*0.5})`;
    if(glowB) glowB.style.transform=`translate(${(0.5-p)*90}px, ${p*60}px) scale(${1+p*0.7})`;
    if(glowA) glowA.style.opacity=0.55+p*0.45;
    const phaseEl=document.getElementById("showPhaseLabel");
    if(phaseEl) phaseEl.textContent=p<0.34?"01 / SESSION":p<0.67?"02 / STACK":"03 / FUEL";
    const chip=document.getElementById("showChip");
    const chipLabel=p<0.34?"PUSH · PULL · LEGS":p<0.67?"CREATINE · WHEY · OMEGA":"PROTEIN · CARBS · FATS";
    if(chip && chip.textContent!==chipLabel) chip.textContent=chipLabel;
  };
  const onScroll=()=>{ if(!ticking){ ticking=true; rafId=requestAnimationFrame(render); } };
  const onResize=onScroll;
  window.addEventListener("scroll", onScroll, { passive:true });
  window.addEventListener("resize", onResize);
  render();
  // 5) canvas shockwave — click fires an expanding ring + chip pulse (decorative delight only)
  const canvasEl=story.querySelector(".show-canvas");
  if(canvasEl && !reduced){
    canvasEl.addEventListener("click", e=>{
      if(e.target.closest("a,button")) return;
      const r=canvasEl.getBoundingClientRect();
      const b=document.createElement("span"); b.className="show-burst";
      b.style.left=(e.clientX-r.left).toFixed(1)+"px"; b.style.top=(e.clientY-r.top).toFixed(1)+"px";
      canvasEl.appendChild(b); setTimeout(()=>b.remove(), 700);
      const chipEl=document.getElementById("showChip");
      if(chipEl){ chipEl.style.transform="translateX(-50%) translateZ(40px) scale(1.3)"; setTimeout(()=>{ chipEl.style.transform=""; },200); }
    });
  }
  function cleanup(){
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    if(rafId) cancelAnimationFrame(rafId);
    try{ if(io) io.disconnect(); }catch(e){}
  }
  window.addEventListener("pagehide", cleanup, { once:true });
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

  // live "active program" card — genuine data, no hardcoded progress
  try{
    const data=loadStorage(), days=data.days||{};
    const key=data.activeProgram;
    const name=key && PROGRAM_DATA[key] ? PROGRAM_DATA[key].title.split(" — ")[0] : "No program set";
    const sessions=Object.keys(days).length;
    let t=0,p=0; Object.values(days).forEach(d=>{ if(d.stack){ t+=d.stack.filter(Boolean).length; p+=d.stack.length; }});
    const adh=p?Math.round(t/p*100):0;
    const setName=document.getElementById("activeProgName"); if(setName) setName.textContent=name;
    const setMeta=document.getElementById("activeProgMeta"); if(setMeta) setMeta.textContent= key ? `${sessions} session${sessions===1?"":"s"} logged · set via Programs` : `${sessions} session${sessions===1?"":"s"} logged · pick a program below`;
    const setPct=document.getElementById("activeProgPct"); if(setPct) setPct.style.width=adh+"%";
    const setLabel=document.getElementById("activeProgPctLabel"); if(setLabel) setLabel.textContent=adh+"% stack adherence";
  }catch(e){ console.error("Active program card failed", e); }

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

// — Personalized meal-plan builder (local estimate + editable preferences) —
function initMealPlans(){
  const form=document.getElementById("mealProfile"), output=document.getElementById("mealResults");
  if(!form||!output) return;
  const saved=loadStorage().mealProfile;
  if(saved){
    Object.entries(saved).forEach(([key,value])=>{
      if(key==="avoid"){form.querySelectorAll('[name="avoid"]').forEach(input=>input.checked=value.includes(input.value));return;}
      const input=form.elements.namedItem(key); if(input) input.value=value;
    });
  }
  const meals=MEAL_CATALOG.map(meal=>({name:meal.name,type:meal.dietary.includes("vegan")?"vegan":meal.dietary.some(d=>["vegetarian","ovo-vegetarian"].includes(d))?"vegetarian":"high-protein",tags:meal.tags,p:meal.nutrition.protein,c:meal.nutrition.carbs,f:meal.nutrition.fats,k:meal.nutrition.kcal,items:meal.ingredients.join(" · ")}));
  let profile={};
  function draw(){
    const f=form.elements, weight=Number(f.weight.value), height=Number(f.height.value), age=Number(f.age.value);
    const activity=Number(f.activity.value), goal=f.goal.value, avoid=[...form.querySelectorAll('[name="avoid"]:checked')].map(x=>x.value);
    const diet=f.diet.value;
    if(!weight||!height||!age) return;
    const base=10*weight+6.25*height-5*age+(f.sex.value==="male"?5:f.sex.value==="female"?-161:-78);
    const maintenance=Math.round(base*activity/50)*50;
    const kcal=Math.max(1200,Math.round((maintenance+(goal==="lose"?-300:goal==="gain"?200:0))/50)*50);
    const protein=Math.round(weight*(goal==="gain"?1.8:1.6));
    const fat=Math.round(kcal*0.28/9), carbs=Math.max(0,Math.round((kcal-protein*4-fat*9)/4));
    const animalFoods=["eggs","fish","poultry","meat"];
    const matchesDiet=m=>{
      if(diet==="any") return true;
      if(diet==="vegetarian") return !m.tags.some(tag=>animalFoods.includes(tag));
      if(diet==="vegan") return m.type==="vegan";
      if(diet==="pescatarian") return !m.tags.some(tag=>["poultry","meat"].includes(tag));
      if(diet==="high-protein") return m.p>=30;
      return true;
    };
    let pool=meals.filter(m=>!m.tags.some(t=>avoid.includes(t)) && matchesDiet(m));
    const rotation=Number(loadStorage().mealRotation||0);
    pool=pool.slice(rotation%Math.max(1,pool.length)).concat(pool.slice(0,rotation%Math.max(1,pool.length)));
    const picks=[pool[0],pool[1],pool[2],pool[3]].filter(Boolean);
    const labels=["BREAKFAST","LUNCH","SNACK","DINNER"];
    output.innerHTML=`<div class="panel-head"><div><span class="mono eyebrow">YOUR SAMPLE DAY</span><h2>${goal==="lose"?"Steady cut":goal==="gain"?"Muscle-building":"Balanced maintenance"}</h2></div><button class="btn btn-sm btn-outline" type="button" id="refreshMeals">↻ Refresh meals</button></div>
      <div class="meal-targets"><div><strong class="mono">${kcal.toLocaleString()}</strong><span>kcal / day</span></div><div><strong class="mono">${protein}g</strong><span>protein</span></div><div><strong class="mono">${carbs}g</strong><span>carbs</span></div><div><strong class="mono">${fat}g</strong><span>fat</span></div></div>
      <p class="meal-target-note">Starting estimate based on your inputs · adjust portions to appetite and training.</p>
      ${picks.length?`<div class="meal-list">${picks.map((m,i)=>`<article class="meal-card"><div class="meal-card-top"><span class="mono meal-label">${labels[i]||"OPTION"}</span><span class="mono meal-kcal">${m.k} kcal</span></div><h3>${m.name}</h3><p>${m.items}</p><div class="meal-macros mono"><span>${m.p}g protein</span><span>${m.c}g carbs</span><span>${m.f}g fat</span></div></article>`).join("")}</div>`:`<div class="meal-no-match"><strong>No meals match those filters yet.</strong><span>Try removing an ingredient exclusion or choosing another plan style. Your food preferences are still applied to every suggestion.</span></div>`}
      <div class="meal-result-foot"><span class="mono">PROFILE SAVED ON THIS DEVICE</span><a href="index.html#fuelPanel" class="btn btn-sm btn-primary">Open fuel log →</a></div>`;
    document.getElementById("refreshMeals").addEventListener("click",()=>{const data=loadStorage();data.mealRotation=Number(data.mealRotation||0)+1;saveStorage(data);draw();});
  }
  form.addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(form);profile={goal:fd.get("goal"),activity:fd.get("activity"),weight:fd.get("weight"),height:fd.get("height"),age:fd.get("age"),sex:fd.get("sex"),diet:fd.get("diet"),avoid:fd.getAll("avoid")};const data=loadStorage();data.mealProfile=profile;saveStorage(data);draw();});
  if(saved) draw();
}

// — Meal catalogue + daily meal diary — local-first, stored with days[date] —
const MEAL_CATALOG=[
  {id:"berry-yogurt",name:"Berry Greek yogurt bowl",type:"breakfast",dietary:["vegetarian","pescatarian"],tags:["dairy","gluten"],goals:["balanced","higher-protein"],serving:"1 bowl · 300 g",nutrition:{protein:24,carbs:38,fats:8,kcal:320},ingredients:["Greek yogurt","Mixed berries","Rolled oats","Chia seeds","Honey"],steps:["Spoon the yogurt into a bowl.","Top with berries, oats, and chia seeds.","Finish with a small drizzle of honey."]},
  {id:"egg-avocado",name:"Egg & avocado toast",type:"breakfast",dietary:["ovo-vegetarian","pescatarian"],tags:["eggs","gluten"],goals:["balanced","higher-protein"],serving:"2 eggs · 1 slice toast",nutrition:{protein:23,carbs:32,fats:22,kcal:410},ingredients:["2 eggs","Whole-grain bread","Avocado","Tomato","Black pepper"],steps:["Toast the bread.","Cook the eggs to your preference.","Top toast with avocado, tomato, and eggs."]},
  {id:"tofu-rice",name:"Tofu power bowl",type:"lunch",dietary:["vegan","vegetarian","gluten-free"],tags:["soy"],goals:["balanced","higher-protein"],serving:"1 bowl · 380 g",nutrition:{protein:29,carbs:58,fats:16,kcal:490},ingredients:["Firm tofu","Brown rice","Edamame","Spinach","Lime-tamari dressing"],steps:["Cook the rice according to its package.","Cube and pan-sear the tofu until golden.","Serve with edamame and spinach; add dressing to taste."]},
  {id:"chicken-quinoa",name:"Chicken quinoa salad",type:"lunch",dietary:["gluten-free"],tags:["poultry"],goals:["higher-protein","lighter"],serving:"1 plate · 360 g",nutrition:{protein:42,carbs:39,fats:12,kcal:430},ingredients:["Chicken breast","Quinoa","Cucumber","Cherry tomatoes","Lemon and herbs"],steps:["Cook quinoa and let it cool slightly.","Grill chicken until fully cooked, then slice.","Toss with chopped vegetables, lemon, and herbs."]},
  {id:"lentil-curry",name:"Lentil curry & rice",type:"dinner",dietary:["vegan","vegetarian","gluten-free"],tags:[],goals:["balanced","lighter"],serving:"1 bowl · 420 g",nutrition:{protein:22,carbs:68,fats:11,kcal:455},ingredients:["Red lentils","Basmati rice","Tomatoes","Light coconut milk","Curry spices"],steps:["Simmer lentils with tomatoes, spices, and a splash of water.","Add coconut milk and cook until the lentils soften.","Serve with cooked basmati rice."]},
  {id:"salmon-potato",name:"Salmon & potato plate",type:"dinner",dietary:["pescatarian","gluten-free"],tags:["fish"],goals:["balanced","higher-protein"],serving:"1 plate · 340 g",nutrition:{protein:38,carbs:42,fats:18,kcal:485},ingredients:["Salmon fillet","Baby potatoes","Green beans","Olive oil","Lemon"],steps:["Roast halved potatoes until tender.","Bake or pan-cook salmon until it flakes easily.","Steam green beans and serve with lemon."]},
  {id:"cottage-fruit",name:"Cottage cheese fruit cup",type:"snack",dietary:["vegetarian","pescatarian","gluten-free"],tags:["dairy"],goals:["lighter","higher-protein"],serving:"1 cup · 250 g",nutrition:{protein:27,carbs:28,fats:6,kcal:270},ingredients:["Cottage cheese","Banana","Blueberries","Pumpkin seeds"],steps:["Add cottage cheese to a cup.","Slice the banana and add it with blueberries.","Sprinkle pumpkin seeds over the top."]},
  {id:"chickpea-wrap",name:"Chickpea hummus wrap",type:"lunch",dietary:["vegan","vegetarian"],tags:["gluten","sesame"],goals:["balanced","lighter"],serving:"1 wrap · 280 g",nutrition:{protein:19,carbs:54,fats:14,kcal:420},ingredients:["Chickpeas","Hummus","Whole-wheat wrap","Cucumber","Lettuce"],steps:["Mash chickpeas lightly with a spoonful of hummus.","Add cucumber and lettuce to the wrap.","Roll tightly and cut in half."]},
  {id:"turkey-sweet-potato",name:"Turkey & sweet potato",type:"dinner",dietary:["gluten-free"],tags:["poultry"],goals:["higher-protein","lighter"],serving:"1 plate · 360 g",nutrition:{protein:40,carbs:43,fats:10,kcal:420},ingredients:["Lean turkey mince","Sweet potato","Broccoli","Garlic","Paprika"],steps:["Roast diced sweet potato until tender.","Cook turkey with garlic and paprika until fully cooked.","Steam broccoli and serve alongside."]},
  {id:"banana-shake",name:"Peanut butter banana shake",type:"snack",dietary:["vegetarian","pescatarian"],tags:["dairy","nuts"],goals:["higher-protein","lighter"],serving:"1 shake · 350 ml",nutrition:{protein:30,carbs:34,fats:14,kcal:380},ingredients:["Milk","Whey protein","Banana","Peanut butter","Ice"],steps:["Add all ingredients to a blender.","Blend until smooth.","Add water or ice to adjust thickness."]}
];
const MEAL_DIET_LABELS={vegetarian:"Vegetarian",vegan:"Vegan",pescatarian:"Pescatarian","gluten-free":"Gluten-free","ovo-vegetarian":"Egg-inclusive vegetarian"};
const MEAL_TYPE_LABELS={breakfast:"Breakfast",lunch:"Lunch",dinner:"Dinner",snack:"Snack"};
function mealDateLimits(){
  const today=new Date(), min=new Date(); min.setDate(min.getDate()-DAYS_TO_KEEP);
  return {today:todayKey(),min:dateKeyOf(min)};
}
function initMealsPage(){
  const page=document.querySelector(".meals-page"); if(!page) return;
  const dateInput=document.getElementById("mealLogDate"), search=document.getElementById("mealSearch"), typeFilter=document.getElementById("mealTypeFilter"), dietFilter=document.getElementById("mealDietFilter"), goalFilter=document.getElementById("mealGoalFilter"), catalog=document.getElementById("mealCatalog"), diary=document.getElementById("dailyMealLog"), summary=document.getElementById("mealNutritionSummary"), count=document.getElementById("mealResultCount"), loggedCount=document.getElementById("loggedMealCount"), form=document.getElementById("mealEntryForm"), entryDialog=document.getElementById("mealEntryDialog"), detailDialog=document.getElementById("mealDetailDialog"), detailBody=document.getElementById("mealDetailBody"), error=document.getElementById("mealEntryError");
  if(!dateInput||!catalog||!diary||!form||!entryDialog||!detailDialog) return;
  const limits=mealDateLimits(); dateInput.min=limits.min; dateInput.max=limits.today; dateInput.value=limits.today;
  const fmtN=(n)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1});
  const isDietMatch=(meal,diet)=>{
    if(diet==="all") return true;
    if(diet==="vegetarian") return meal.dietary.includes("vegetarian")||meal.dietary.includes("vegan");
    if(diet==="vegan") return meal.dietary.includes("vegan");
    if(diet==="pescatarian") return meal.dietary.some(d=>["pescatarian","vegetarian","vegan","ovo-vegetarian"].includes(d));
    return meal.dietary.includes(diet);
  };
  const renderCatalog=()=>{
    catalog.setAttribute("aria-busy","true");
    const q=(search.value||"").trim().toLowerCase(), type=typeFilter.value, diet=dietFilter.value, goal=goalFilter.value;
    const matches=MEAL_CATALOG.filter(m=>{
      const haystack=[m.name,m.type,...m.ingredients,...m.dietary,...m.goals].join(" ").toLowerCase();
      const goalMatch=goal==="all"||m.goals.includes(goal);
      return (!q||haystack.includes(q))&&(type==="all"||m.type===type)&&isDietMatch(m,diet)&&goalMatch;
    });
    count.textContent=`${matches.length} ${matches.length===1?"MEAL":"MEALS"}`;
    catalog.innerHTML=matches.length?matches.map(m=>`<article class="meal-catalog-card"><div class="meal-card-top"><span class="mono meal-label">${MEAL_TYPE_LABELS[m.type].toUpperCase()}</span><span class="mono meal-kcal">${m.nutrition.kcal} kcal</span></div><h3>${escapeHTML(m.name)}</h3><p class="meal-card-serving">${escapeHTML(m.serving)}</p><div class="meal-catalog-meta"><span>${m.nutrition.protein}g protein</span><span>${m.nutrition.carbs}g carbs</span><span>${m.nutrition.fats}g fat</span></div><div class="meal-card-actions"><button type="button" class="btn btn-sm btn-ghost" data-meal-view="${m.id}">Details</button><button type="button" class="btn btn-sm btn-primary" data-meal-add="${m.id}">+ Add meal</button></div></article>`).join(""):`<div class="meal-catalog-empty"><strong>No meals found</strong><span>Try a different search or clear one of the filters.</span><button type="button" class="btn btn-sm btn-outline" id="clearMealFilters">Clear filters</button></div>`;
    document.getElementById("clearMealFilters")?.addEventListener("click",()=>{search.value="";typeFilter.value="all";dietFilter.value="all";goalFilter.value="all";renderCatalog();});
    catalog.setAttribute("aria-busy","false");
  };
  const selectedDate=()=>dateInput.value||limits.today;
  const renderDay=()=>{
    const data=loadStorage(), day=data.days?.[selectedDate()]||{}, fuel={...zeroFuel(),...(day.fuel||{})}, totals=[
      ["protein","PROTEIN","g",FUEL_TARGETS.protein],["carbs","CARBS","g",FUEL_TARGETS.carbs],["fats","FAT","g",FUEL_TARGETS.fats],["kcal","CALORIES","kcal",FUEL_TARGETS.kcal]
    ];
    summary.innerHTML=totals.map(([key,label,unit,target])=>{const value=Number(fuel[key])||0,pct=Math.min(100,Math.round(value/target*100));return `<article class="meal-summary-card"><div><span class="mono">${label}</span><strong class="mono">${fmtN(value)}<small> / ${target} ${unit}</small></strong></div><div class="meal-summary-track" role="progressbar" aria-label="${label.toLowerCase()} progress" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(value,target)}"><span style="width:${pct}%"></span></div></article>`;}).join("");
    const entries=Array.isArray(day.meals)?day.meals:[]; loggedCount.textContent=`${entries.length} ${entries.length===1?"MEAL":"MEALS"}`;
    diary.innerHTML=entries.length?`<div class="daily-meal-list">${entries.map(entry=>{const n=entry.nutrition||zeroFuel(), servings=Number(entry.servings)||1, total=getLoggedMealNutrition([entry]);return `<article class="daily-meal-entry"><div class="daily-meal-entry-main"><div class="meal-card-top"><span class="mono meal-label">${escapeHTML(MEAL_TYPE_LABELS[entry.type]||"Meal").toUpperCase()} · ${fmtN(servings)} SERVING${servings===1?"":"S"}</span><span class="mono meal-kcal">${fmtN(total.kcal)} kcal</span></div><h3>${escapeHTML(entry.name)}</h3><p>${escapeHTML(entry.servingSize||"1 serving")} · ${fmtN(n.protein*servings)}P · ${fmtN(n.carbs*servings)}C · ${fmtN(n.fats*servings)}F</p></div><div class="daily-meal-actions"><button type="button" class="icon-btn" data-entry-edit="${escapeHTML(entry.id)}" aria-label="Edit ${escapeHTML(entry.name)}">✎</button><button type="button" class="icon-btn" data-entry-delete="${escapeHTML(entry.id)}" aria-label="Remove ${escapeHTML(entry.name)}" title="Remove">×</button></div></article>`;}).join("")}</div>`:`<div class="meal-log-empty"><strong>No meals logged for this date</strong><span>Browse the catalogue and add your first meal. Meals you add here contribute to the daily totals above.</span></div>`;
  };
  const showError=(message)=>{error.textContent=message;error.hidden=false;};
  const clearError=()=>{error.textContent="";error.hidden=true;};
  const setFormValues=(entry,date,editing=false)=>{
    const values={entryId:editing?entry.id:"",sourceDate:editing?date:"",mealId:entry.mealId||"",name:entry.name,type:entry.type,date,servings:entry.servings||1,servingSize:entry.servingSize||"1 serving",protein:entry.nutrition?.protein??0,carbs:entry.nutrition?.carbs??0,fats:entry.nutrition?.fats??0,kcal:entry.nutrition?.kcal??0};
    Object.entries(values).forEach(([key,value])=>{const field=form.elements.namedItem(key);if(field)field.value=value;});
    form.elements.namedItem("date").min=limits.min;form.elements.namedItem("date").max=limits.today;
    document.getElementById("mealEntryTitle").textContent=editing?"Edit logged meal":"Log a meal";
    document.getElementById("saveMealEntry").textContent=editing?"Save changes":"Add to log";clearError();
    entryDialog.showModal();
  };
  const openEntryForCatalog=(meal)=>setFormValues({mealId:meal.id,name:meal.name,type:meal.type,servings:1,servingSize:meal.serving,nutrition:meal.nutrition},selectedDate());
  const openDetails=(meal)=>{
    detailBody.innerHTML=`<h2 id="mealDetailTitle">${escapeHTML(meal.name)}</h2><p class="meal-detail-serving">${escapeHTML(MEAL_TYPE_LABELS[meal.type])} · ${escapeHTML(meal.serving)}</p><div class="meal-catalog-meta meal-detail-macros"><span>${meal.nutrition.protein}g protein</span><span>${meal.nutrition.carbs}g carbs</span><span>${meal.nutrition.fats}g fat</span><span>${meal.nutrition.kcal} kcal</span></div><h3>Ingredients</h3><ul class="meal-detail-ingredients">${meal.ingredients.map(item=>`<li>${escapeHTML(item)}</li>`).join("")}</ul><h3>Preparation</h3><ol class="meal-detail-steps">${meal.steps.map(step=>`<li>${escapeHTML(step)}</li>`).join("")}</ol><div class="meal-detail-footer"><span class="mono">${meal.dietary.map(d=>MEAL_DIET_LABELS[d]||d).join(" · ")}</span><button type="button" class="btn btn-primary" data-detail-add="${meal.id}">Add to daily log →</button></div>`;
    detailDialog.showModal();
  };
  const ensureDay=(data,date)=>{if(!data.days)data.days={};if(!data.days[date])data.days[date]={lifts:[],stack:[]};const day=data.days[date];if(!day.fuelManual)day.fuelManual=getManualFuel(day);if(!Array.isArray(day.meals))day.meals=[];return day;};
  const persistDayChanges=(data)=>{pruneOldDays(data);if(!saveStorage(data))return false;renderDay();window.NutriliftToast&&window.NutriliftToast("Meal log saved");return true;};
  search.addEventListener("input",renderCatalog);[typeFilter,dietFilter,goalFilter].forEach(control=>control.addEventListener("change",renderCatalog));
  dateInput.addEventListener("change",()=>{if(!parseISODateKey(dateInput.value)||dateInput.value>limits.today||dateInput.value<limits.min){dateInput.value=limits.today;window.NutriliftToast&&window.NutriliftToast("Choose a date within the last 90 days");}renderDay();});
  catalog.addEventListener("click",event=>{const view=event.target.closest("[data-meal-view]"),add=event.target.closest("[data-meal-add]");if(view){const meal=MEAL_CATALOG.find(m=>m.id===view.dataset.mealView);if(meal)openDetails(meal);}else if(add){const meal=MEAL_CATALOG.find(m=>m.id===add.dataset.mealAdd);if(meal)openEntryForCatalog(meal);}});
  detailBody.addEventListener("click",event=>{const button=event.target.closest("[data-detail-add]");if(!button)return;const meal=MEAL_CATALOG.find(m=>m.id===button.dataset.detailAdd);if(meal){detailDialog.close();openEntryForCatalog(meal);}});
  document.getElementById("customMealBtn")?.addEventListener("click",()=>setFormValues({name:"Custom meal",type:"snack",servings:1,servingSize:"1 serving",nutrition:zeroFuel()},selectedDate()));
  diary.addEventListener("click",event=>{
    const edit=event.target.closest("[data-entry-edit]"), remove=event.target.closest("[data-entry-delete]");if(!edit&&!remove)return;
    const date=selectedDate(), data=loadStorage(), day=data.days?.[date], id=(edit||remove).dataset.entryEdit||(edit||remove).dataset.entryDelete, entry=day?.meals?.find(m=>m.id===id);if(!entry)return;
    if(edit){setFormValues(entry,date,true);return;}
    const targetDay=ensureDay(data,date);targetDay.meals=targetDay.meals.filter(m=>m.id!==id);rebuildDayFuel(targetDay);persistDayChanges(data);
  });
  form.addEventListener("submit",event=>{
    event.preventDefault();clearError();if(!form.reportValidity())return;
    const fd=new FormData(form), date=String(fd.get("date")||""), name=String(fd.get("name")||"").trim(), servings=Number(fd.get("servings")), nutrition={protein:Number(fd.get("protein")),carbs:Number(fd.get("carbs")),fats:Number(fd.get("fats")),kcal:Number(fd.get("kcal"))};
    if(name.length<2){showError("Enter a meal name with at least 2 characters.");return;}
    if(!parseISODateKey(date)||date<limits.min||date>limits.today){showError("Choose a valid date within the last 90 days.");return;}
    if(!Number.isFinite(servings)||servings<0.25||servings>10){showError("Servings must be between 0.25 and 10.");return;}
    if(Object.values(nutrition).some(value=>!Number.isFinite(value)||value<0)){showError("Nutrition values must be zero or greater.");return;}
    const id=String(fd.get("entryId")||""), sourceDate=String(fd.get("sourceDate")||""), data=loadStorage();
    const entry={id:id||`meal-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,mealId:String(fd.get("mealId")||""),name,type:String(fd.get("type")),servings,servingSize:String(fd.get("servingSize")||"").trim(),nutrition};
    if(id){
      const oldDay=data.days?.[sourceDate], oldIndex=oldDay?.meals?.findIndex(m=>m.id===id)??-1;
      if(!oldDay||oldIndex<0){showError("That logged meal could not be found. Close this form and refresh the meal log.");return;}
      if(!oldDay.fuelManual)oldDay.fuelManual=getManualFuel(oldDay);
      oldDay.meals.splice(oldIndex,1);
      const newDay=sourceDate===date?oldDay:ensureDay(data,date);
      if(sourceDate===date&&!Array.isArray(newDay.meals))newDay.meals=[];
      newDay.meals.push(entry);rebuildDayFuel(oldDay);if(newDay!==oldDay)rebuildDayFuel(newDay);
    }else{
      const day=ensureDay(data,date);day.meals.push(entry);rebuildDayFuel(day);
    }
    if(persistDayChanges(data)){dateInput.value=date;renderDay();entryDialog.close();form.reset();}
  });
  page.querySelectorAll("[data-close-dialog]").forEach(button=>button.addEventListener("click",()=>document.getElementById(button.dataset.closeDialog)?.close()));
  [entryDialog,detailDialog].forEach(dialog=>dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();}));
  renderCatalog();renderDay();
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
  initBodyWeight();
  initWeekInsights();
  initReveal();
  initTilt3D();
  initToasts();
  initShortcuts();
  initBeastMode();
  initBowShoot();
  initActiveNav();
  initMobileNav();
  initFormValidation();
  initProgramsPage();
  initHistoryPage();
  initHistoryImport();
  initShowcase();
  initMealPlans();
  initMealsPage();
});
