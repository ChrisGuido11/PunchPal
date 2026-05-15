/* PunchPal — App Store screenshots */
const { useState, useEffect, useRef } = React;

/* ──────────────────────────────────────────────────────────────
   STATUS BAR — clean 9:41, full signal, full battery
   ────────────────────────────────────────────────────────────── */
function StatusBar({ light }) {
  const color = light ? '#000' : '#fff';
  return (
    <div className={`status-bar ${light ? 'light-bg' : 'dark-bg'}`}>
      <div className="status-time">9:41</div>
      <div className="status-right">
        {/* Signal */}
        <svg width="34" height="22" viewBox="0 0 34 22" fill={color}>
          <rect x="0"  y="14" width="5" height="8" rx="1"/>
          <rect x="8"  y="10" width="5" height="12" rx="1"/>
          <rect x="16" y="6"  width="5" height="16" rx="1"/>
          <rect x="24" y="2"  width="5" height="20" rx="1"/>
        </svg>
        {/* 5G */}
        <span style={{ font: '600 26px -apple-system, "SF Pro Text", sans-serif', letterSpacing: '-0.02em', color }}>
          5G
        </span>
        {/* Battery */}
        <svg width="56" height="26" viewBox="0 0 56 26" fill="none">
          <rect x="1" y="1" width="48" height="24" rx="6" stroke={color} strokeWidth="2" opacity="0.5"/>
          <rect x="52" y="9" width="3" height="8" rx="1.5" fill={color} opacity="0.5"/>
          <rect x="4" y="4" width="42" height="18" rx="3.5" fill={color}/>
        </svg>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PHONE FRAME — titanium iPhone 16 Pro Max
   ────────────────────────────────────────────────────────────── */
function Phone({ src, tilted, children, imgStyle, statusLight }) {
  return (
    <div className={`phone-stage ${tilted ? 'tilted' : ''}`}>
      <div className="phone">
        <div className="phone-inner">
          <div className="screen">
            <img className="app" src={src} style={imgStyle} alt="" />
            <StatusBar light={statusLight} />
            <div className="dynamic-island" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SHOT 1 — HOME
   ────────────────────────────────────────────────────────────── */
function Shot01() {
  return (
    <div className="shot" id="shot-1" data-screen-label="01 Home">
      <div className="glow" />
      <div className="grain" />
      <div className="copyzone">
        <h2 className="headline">
          <span className="row">A REAL <span className="uline-red">BOXING</span> COACH.</span>
          <span className="row">IN YOUR POCKET<span className="red-dot"></span></span>
        </h2>
        <p className="subhead">
          A fresh AI workout in three seconds. Hit start. Improve.
        </p>
      </div>
      {/* Source image: home.png — already clean (no ad).
          We position it so the app status bar area is cropped out behind our clean status bar. */}
      <Phone src="src/home.png" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SHOT 2 — WORKOUT ENGINE (loading, slight tilt)
   ────────────────────────────────────────────────────────────── */
function Shot02() {
  return (
    <div className="shot" id="shot-2" data-screen-label="02 Workout Engine">
      <div className="glow" />
      <div className="grain" />
      <div className="copyzone">
        <h2 className="headline">
          <span className="row">EVERY WORKOUT.</span>
          <span className="row">BUILT FROM <span className="uline-red">SCRATCH</span>.</span>
        </h2>
        <p className="subhead">
          A unique session every time you tap “Get Fresh Workout.”
        </p>
        <div className="badge-claude">
          <span className="anth-dot" /> Powered by Claude
        </div>
      </div>
      <Phone src="src/loading.png" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SHOT 3 — TIMER + COMBO callout
   ────────────────────────────────────────────────────────────── */
function Shot03() {
  return (
    <div className="shot" id="shot-3" data-screen-label="03 Timer">
      <div className="glow" />
      <div className="grain" />
      <div className="copyzone">
        <h2 className="headline">
          <span className="row">REAL PRO MECHANICS.</span>
          <span className="row">CALLED <span className="uline-red">OUT LOUD</span>.</span>
        </h2>
        <p className="subhead">
          Slip. Counter. Pivot. The phone coaches you so your eyes stay forward.
        </p>
      </div>
      <Phone src="src/timer.png" />
      {/* External speech bubble — positioned at the combo card on the timer screen */}
      <div className="bubble" style={{ right: 40, top: 1830 }}>
        <span className="voice-icon">▶</span>JAB. CROSS.<br />LEAD HOOK. CROSS.
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SHOT 4 — RATING MODAL
   ────────────────────────────────────────────────────────────── */
function Shot04() {
  return (
    <div className="shot" id="shot-4" data-screen-label="04 Rating">
      <div className="glow" />
      <div className="grain" />
      <div className="copyzone">
        <h2 className="headline">
          <span className="row">RATE EVERY ROUND.</span>
          <span className="row">THE AI GETS <span className="uline-red">SMARTER</span>.</span>
        </h2>
        <p className="subhead">
          Too easy, just right, or too hard. Your feedback rewrites the next workout.
        </p>
      </div>
      <Phone src="src/rating.png" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SHOT 5 — PROFILE (gold accent on DAY, slight tilt)
   ────────────────────────────────────────────────────────────── */
function Shot05() {
  return (
    <div className="shot" id="shot-5" data-screen-label="05 Profile">
      <div className="glow" />
      <div className="grain" />
      <div className="copyzone">
        <h2 className="headline">
          <span className="row">NEVER MISS</span>
          <span className="row">A <span className="uline-gold gold">DAY</span>.</span>
        </h2>
        <p className="subhead">
          Streaks, training stats, and nine progression tiers from beginner to pro.
        </p>
      </div>
      <Phone src="src/profile.png" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SHOT 6 — FREE FOREVER
   ────────────────────────────────────────────────────────────── */
function Shot06() {
  return (
    <div className="shot" id="shot-6" data-screen-label="06 Free Forever">
      <div className="glow" />
      <div className="grain" />
      <div className="copyzone">
        <h2 className="headline">
          <span className="row"><span className="red">FREE</span> FOREVER.</span>
          <span className="row">NO PAYWALL<span className="red-dot"></span></span>
        </h2>
        <p className="subhead">
          No subscription. No premium tier. Just boxing.
        </p>
      </div>
      <Phone src="src/home.png" />
      <div className="sig-line">PUNCHPAL · V1.1</div>
    </div>
  );
}

const ALL_SHOTS = [
  { n: 1, Comp: Shot01, label: '01_home.png' },
  { n: 2, Comp: Shot02, label: '02_workout_engine.png' },
  { n: 3, Comp: Shot03, label: '03_timer.png' },
  { n: 4, Comp: Shot04, label: '04_rating.png' },
  { n: 5, Comp: Shot05, label: '05_profile.png' },
  { n: 6, Comp: Shot06, label: '06_free_forever.png' },
];

/* ──────────────────────────────────────────────────────────────
   THUMBNAIL VIEW — what the user sees in App Store search
   ────────────────────────────────────────────────────────────── */
function ThumbnailStrip({ onOpen }) {
  const [thumbW, setThumbW] = useState(220);
  useEffect(() => {
    function update() {
      const w = Math.min(window.innerWidth - 64, 1600);
      // try to fit 6 in a row; clamp 160..260
      const target = Math.max(140, Math.min(260, (w - 5 * 18) / 6));
      setThumbW(target);
      document.documentElement.style.setProperty('--thumb-w', target + 'px');
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const scale = thumbW / 1320;
  return (
    <div className="strip-wrap">
      <h2 className="strip-title">THUMBNAIL CHECK</h2>
      <p className="strip-sub">
        Six screenshots as they appear on the App Store listing. 80% of shoppers see them at this size — headlines must read instantly.
      </p>
      <div className="strip">
        {ALL_SHOTS.map(({ n, Comp, label }) => (
          <div key={n}>
            <div
              className="thumb"
              onClick={() => onOpen(n)}
              style={{ width: thumbW, height: thumbW * 2868 / 1320 }}
            >
              <div className="scaled" style={{ transform: `scale(${scale})` }}>
                <Comp />
              </div>
              <div className="thumb-label">{label}</div>
            </div>
            <div className="file-cap">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   FULL REVIEW VIEW — every shot at viewable scale, stacked
   ────────────────────────────────────────────────────────────── */
function FullReview() {
  const [scale, setScale] = useState(0.32);
  useEffect(() => {
    function update() {
      const w = Math.min(window.innerWidth - 80, 1200);
      setScale(Math.min(0.42, w / 1320));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty('--review-scale', scale);
  }, [scale]);
  return (
    <div className="full-wrap">
      {ALL_SHOTS.map(({ n, Comp, label }) => (
        <div key={n} style={{ width: 1320 * scale, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ font: '500 12px Inter, sans-serif', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            {label} · 1320 × 2868
          </div>
          <Comp />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ROOT
   ────────────────────────────────────────────────────────────── */
function App() {
  const [view, setView] = useState(() =>
    window.location.hash === '#full' ? 'full' :
    window.location.hash === '#export' ? 'export' : 'thumb'
  );
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);

  // Apply tweaks as CSS variables on :root so every .shot picks them up
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--phone-tilt', t.phoneTilt + 'deg');
    r.style.setProperty('--phone-bottom', t.phoneBottom + 'px');
    r.style.setProperty('--copy-top', t.copyTop + 'px');
  }, [t.phoneTilt, t.phoneBottom, t.copyTop]);

  // Export mode: render ALL 6 at 1:1 stacked, no chrome. For PNG capture.
  const exportMode = view === 'export' || (typeof window !== 'undefined' && window.__EXPORT_ONE != null);

  useEffect(() => {
    document.body.classList.toggle('export-mode', exportMode);
  }, [exportMode]);

  useEffect(() => {
    document.getElementById('view-thumb').onclick = () => { setView('thumb'); window.location.hash = ''; };
    document.getElementById('view-full').onclick  = () => { setView('full');  window.location.hash = 'full'; };
  }, []);

  const openFocus = (n) => {
    const overlay = document.getElementById('focus');
    const content = document.getElementById('focus-content');
    const Comp = ALL_SHOTS.find(s => s.n === n).Comp;
    const root = ReactDOM.createRoot(content);
    root.render(<Comp />);
    document.documentElement.style.setProperty('--focus-scale', Math.min(window.innerHeight * 0.92 / 2868, 0.5));
    overlay.classList.add('show');
  };

  if (view === 'export') {
    // For capture: render only one shot at exact 1320×2868, no padding
    const which = Number(new URLSearchParams(window.location.search).get('n') || 1);
    const Comp = (ALL_SHOTS.find(s => s.n === which) || ALL_SHOTS[0]).Comp;
    return (
      <div style={{ width: 1320, height: 2868, margin: 0, padding: 0, position: 'absolute', top: 0, left: 0 }}>
        <Comp />
      </div>
    );
  }

  // Expose a globally-callable "set current shot" for batch capture
  useEffect(() => {
    window.__showShot = (n) => {
      setView('export');
      const url = new URL(window.location.href);
      url.searchParams.set('n', n);
      url.hash = 'export';
      window.history.replaceState(null, '', url.toString());
      // Force re-render by hash change
      setTimeout(() => setView('export'), 10);
    };
  }, []);

  if (view === 'thumb') return (
    <>
      <ThumbnailStrip onOpen={openFocus} />
      <TweaksUI t={t} setTweak={setTweak} />
    </>
  );
  return (
    <>
      <FullReview />
      <TweaksUI t={t} setTweak={setTweak} />
    </>
  );
}

function TweaksUI({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Phone" />
      <TweakSlider
        label="Tilt"
        value={t.phoneTilt}
        min={-15} max={15} step={1} unit="°"
        onChange={(v) => setTweak('phoneTilt', v)}
      />
      <TweakSlider
        label="Distance from bottom"
        value={t.phoneBottom}
        min={80} max={500} step={10} unit="px"
        onChange={(v) => setTweak('phoneBottom', v)}
      />
      <TweakSection label="Copy" />
      <TweakSlider
        label="Top margin"
        value={t.copyTop}
        min={60} max={260} step={5} unit="px"
        onChange={(v) => setTweak('copyTop', v)}
      />
    </TweaksPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   EXPORT — render any shot to a 1320×2868 PNG data-URL
   ────────────────────────────────────────────────────────────── */
async function exportShotToDataURL(n) {
  // Wait for fonts
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Create an offscreen container at full 1320×2868
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed; left:-99999px; top:0; width:1320px; height:2868px; background:#000; z-index:-1;';
  document.body.appendChild(host);

  const Comp = (ALL_SHOTS.find(s => s.n === n) || ALL_SHOTS[0]).Comp;
  const root = ReactDOM.createRoot(host);
  await new Promise(resolve => {
    root.render(React.createElement(Comp));
    // wait a few frames for layout + images to settle
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 500)));
  });

  // wait for all images inside the host to load
  const imgs = host.querySelectorAll('img');
  await Promise.all([...imgs].map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; })));

  // Use html-to-image
  const dataUrl = await window.htmlToImage.toPng(host, {
    width: 1320, height: 2868,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: '#000',
  });

  root.unmount();
  host.remove();
  return dataUrl;
}
window.exportShotToDataURL = exportShotToDataURL;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
