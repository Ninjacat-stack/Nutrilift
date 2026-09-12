// showcase-3d.js — WebGL upgrade for showcase.html ONLY. CSS 3D stays as fallback.
// Red + black cinematic: iron plate + core + particles, scroll-driven, mouse parallax.
// Perf: capped DPR, pause offscreen/hidden, rAF-only transforms, mobile-lite, reduced-motion safe.
const canvas = document.getElementById('webgl-canvas');
const story = document.getElementById('showStory');
const objFallback = document.getElementById('showObject');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 860 || coarse;

function liveNumbers() {
  try {
    const s = JSON.parse(localStorage.getItem('nutrilift:v1') || '{}');
    const days = s.days || {};
    let lifts = 0, taken = 0;
    Object.values(days).forEach((d) => {
      if (d.lifts) lifts += d.lifts.filter(Boolean).length;
      if (d.stack) taken += d.stack.filter(Boolean).length;
    });
    let streak = 0; // reuse computeStreak if present
    try { streak = typeof computeStreak === 'function' ? computeStreak(s) : 0; } catch (e) { streak = 0; }
    return { lifts, taken, days: Object.keys(days).length, streak };
  } catch (e) { return { lifts: 0, taken: 0, days: 0, streak: 0 }; }
}

// — Always-on UI FX (no WebGL needed): dots, counters, magnetic, glare, cursor —
(function uiFx() {
  try {
    const dots = Array.from(document.querySelectorAll('.show-dot'));
    const steps = Array.from(document.querySelectorAll('.show-step'));
    if (steps.length && dots.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        es.forEach((en) => {
          if (!en.isIntersecting) return;
          const i = steps.indexOf(en.target);
          dots.forEach((d, j) => d.classList.toggle('is-on', j === i));
        });
      }, { rootMargin: '-40% 0px -40% 0px', threshold: 0.1 });
      steps.forEach((s) => io.observe(s));
      window.addEventListener('pagehide', () => { try { io.disconnect(); } catch (e) {} }, { once: true });
    }
    // animated counters from REAL storage
    const nums = liveNumbers();
    const map = { specLifts: nums.lifts, specStack: nums.taken, specDays: nums.days, specStreak: nums.streak };
    const els = Object.keys(map).map((id) => document.getElementById(id)).filter(Boolean);
    if (els.length && 'IntersectionObserver' in window && !reduced) {
      const cio = new IntersectionObserver((es) => {
        es.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target, target = map[el.id] || 0, t0 = performance.now();
          const tick = (t) => {
            const p = Math.min(1, (t - t0) / 900);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          cio.unobserve(el);
        });
      }, { threshold: 0.4 });
      els.forEach((el) => cio.observe(el));
    } else {
      Object.keys(map).forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = map[id]; });
    }
    // magnetic buttons (transform only, fine pointer only)
    if (!coarse && !reduced) {
      document.querySelectorAll('.showcase .btn').forEach((b) => {
        let raf = 0;
        b.addEventListener('mousemove', (e) => {
          const r = b.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          if (raf) return;
          raf = requestAnimationFrame(() => {
            b.style.transform = `translate(${(dx * 0.12).toFixed(1)}px, ${(dy * 0.16).toFixed(1)}px)`;
            raf = 0;
          });
        }, { passive: true });
        b.addEventListener('mouseleave', () => { cancelAnimationFrame(raf); raf = 0; b.style.transform = ''; }, { passive: true });
      });
      // card glare follows cursor via --mx/--my
      document.querySelectorAll('.show-card, .show-feature-card').forEach((c) => {
        c.addEventListener('mousemove', (e) => {
          const r = c.getBoundingClientRect();
          c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
          c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        }, { passive: true });
      });
      // red cursor glow follower (transform only)
      const glow = document.getElementById('showCursorGlow');
      if (glow) {
        let gx = -200, gy = -200, tx = gx, ty = gy, raf = 0;
        const loop = () => {
          gx += (tx - gx) * 0.16; gy += (ty - gy) * 0.16;
          glow.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px)`;
          raf = requestAnimationFrame(loop);
        };
        document.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
        raf = requestAnimationFrame(loop);
        window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });
      }
    }
  } catch (e) { /* never break page for FX */ }
})();

// — WebGL scene (lazy, guarded, disposable) —
if (!canvas || !story || reduced) {
  if (canvas) canvas.style.display = 'none';
} else {
  let renderer = null, raf = 0, disposed = false;
  const cleanup = () => {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    try { renderer && renderer.dispose(); } catch (e) {}
    if (canvas) canvas.style.display = 'none';
    if (objFallback) objFallback.style.opacity = '1';
  };
  const onVis = () => { if (!document.hidden && !raf) raf = requestAnimationFrame(loop); };
  const onResize = () => {
    try {
      if (!renderer) return;
      const w = canvas.clientWidth || canvas.parentElement.clientWidth, h = canvas.clientHeight || canvas.parentElement.clientHeight;
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
    } catch (e) {}
  };
  const onScroll = (() => {
    let t = false;
    return () => { if (!t) { t = true; requestAnimationFrame(() => { t = false; }); } };
  })();

  (async () => {
    let THREE;
    try { THREE = await import('three'); }
    catch (e) { if (canvas) canvas.style.display = 'none'; return; } // CDN fail → CSS fallback stays
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isMobile(), powerPreference: 'high-performance' });
      renderer.setClearColor(0x000000, 0);
      onResize();
      if (objFallback) objFallback.style.opacity = '0.92'; // WebGL behind, CSS glass over

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x080505, 0.055);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
      camera.position.set(0, 0, 6.2);
      const aspect = () => {
        const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
        camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      aspect();

      scene.add(new THREE.AmbientLight(0x431417, 1.1));
      const key = new THREE.PointLight(0xff2a4d, 60, 30); key.position.set(3.5, 2.5, 4); scene.add(key);
      const rim = new THREE.PointLight(0xffffff, 14, 25); rim.position.set(-4, -2, -2); scene.add(rim);
      const top = new THREE.SpotLight(0xff5a7a, 40, 30, 0.6); top.position.set(0, 6, 3); scene.add(top);

      const group = new THREE.Group(); scene.add(group);
      const plateMat = new THREE.MeshStandardMaterial({ color: 0x1c0e0e, metalness: 0.92, roughness: 0.28, emissive: 0xc81e3d, emissiveIntensity: 0.32 });
      const plate = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.42, 40, 110), plateMat);
      const wire = new THREE.Mesh(
        new THREE.TorusGeometry(1.6, 0.42, 10, 60),
        new THREE.MeshBasicMaterial({ color: 0xff4d6d, wireframe: true, transparent: true, opacity: 0.14 })
      );
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({ color: 0x2a0d12, metalness: 0.6, roughness: 0.2, emissive: 0xff2448, emissiveIntensity: 1.4 })
      );
      const orbit1 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.012, 8, 120), new THREE.MeshBasicMaterial({ color: 0xd3335a, transparent: true, opacity: 0.5 }));
      const orbit2 = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.008, 8, 120), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 }));
      orbit1.rotation.x = Math.PI / 2.4; orbit2.rotation.x = Math.PI / 1.8;
      group.add(plate, wire, core, orbit1, orbit2);

      // glow sprite (generated, no asset download)
      const glowTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d').createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,60,90,0.85)'); g.addColorStop(0.4, 'rgba(200,30,61,0.28)'); g.addColorStop(1, 'rgba(200,30,61,0)');
        const ctx = c.getContext('2d'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c); return t;
      })();
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(7, 7, 1); scene.add(glow);

      // particles: red/white starfield
      const COUNT = isMobile() ? 420 : 1200;
      const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3);
      const cA = new THREE.Color(0xff3b5c), cB = new THREE.Color(0x8a7f7c);
      for (let i = 0; i < COUNT; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 16;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
        const c = Math.random() < 0.35 ? cA : cB;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const stars = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.025, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(stars);

      let mx = 0, my = 0, smx = 0, smy = 0, prog = 0, sProg = 0;
      document.addEventListener('mousemove', (e) => {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
      const progOf = () => {
        const r = story.getBoundingClientRect();
        const total = Math.max(1, story.offsetHeight - window.innerHeight);
        return Math.min(1, Math.max(0, -r.top / total));
      };
      let visible = true;
      try {
        new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf && !document.hidden) raf = requestAnimationFrame(loop); }).observe(story);
      } catch (e) {}
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', () => { onResize(); aspect(); });
      window.addEventListener('pagehide', cleanup, { once: true });

      const clock = new THREE.Clock();
      function loop() {
        if (disposed || document.hidden) { raf = 0; return; }
        raf = requestAnimationFrame(loop);
        const t = clock.getElapsedTime();
        prog += ((() => { try { return progOf(); } catch (e) { return 0; } })() - prog) * 0.08;
        sProg = prog; // already damped
        smx += (mx - smx) * 0.05; smy += (my - smy) * 0.05;
        // cinematic scroll choreography
        group.rotation.y = t * 0.25 + sProg * Math.PI * 2.4;
        group.rotation.x = 0.35 - sProg * 0.7 + smy * 0.12;
        group.rotation.z = smx * 0.08;
        const sc = (isMobile() ? 0.9 : 1) + sProg * 0.45;
        group.scale.setScalar(sc);
        group.position.x = (sProg - 0.5) * (isMobile() ? 0.3 : 0.9);
        group.position.y = -sProg * 0.35;
        plateMat.emissiveIntensity = 0.3 + sProg * 1.0 + Math.sin(t * 2.2) * 0.06;
        core.rotation.y = -t * 0.9; core.rotation.x = t * 0.5;
        orbit1.rotation.z = t * 0.18; orbit2.rotation.z = -t * 0.12;
        stars.rotation.y = t * 0.015 + sProg * 0.6;
        glow.material.opacity = 0.4 + sProg * 0.35;
        camera.position.x = smx * 0.5;
        camera.position.y = -smy * 0.35;
        camera.position.z = 6.2 - sProg * 1.1;
        camera.lookAt(0, 0, 0);
        try { renderer.render(scene, camera); } catch (e) { cleanup(); }
      }
      raf = requestAnimationFrame(loop);
    } catch (e) { try { canvas.style.display = 'none'; } catch (e2) {} }
  })();
}
