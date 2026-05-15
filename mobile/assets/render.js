/* Canvas renderer for PunchPal App Store screenshots.
   Pure 2D canvas, drawn at exact 1320×2868. Saves PNGs via saveFile.
*/
/* eslint-disable */
async function renderAll(R) {
  const { readImage, saveFile, log, createCanvas } = R;

  /* ---------------- CONSTANTS ---------------- */
  const W = 1320, H = 2868;
  const RED = '#DC2626';
  const RED_DEEP = '#B91C1C';
  const GOLD = '#D4AF37';
  const MUTED = 'rgba(255,255,255,0.65)';

  // Phone geometry
  const PHONE_W = 880;
  const PHONE_H = 1808;
  const PHONE_PAD = 14;
  const PHONE_R_OUT = 108;
  const PHONE_R_IN = 94;
  const PHONE_CX = W / 2;            // 660
  const PHONE_BOTTOM_MARGIN = 100;
  const PHONE_TOP = H - PHONE_BOTTOM_MARGIN - PHONE_H;  // 960
  const SCREEN_X = PHONE_CX - PHONE_W/2 + PHONE_PAD;    // 234
  const SCREEN_Y = PHONE_TOP + PHONE_PAD;                // 974
  const SCREEN_W = PHONE_W - 2*PHONE_PAD;                // 852
  const SCREEN_H = PHONE_H - 2*PHONE_PAD;                // 1780
  const STATUS_H = 110;

  /* ---------------- HELPERS ---------------- */
  function roundRectPath(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawBackground(ctx) {
    // pure black
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // red radial glow behind phone
    const grad = ctx.createRadialGradient(W/2, H*0.6, 0, W/2, H*0.6, W*0.62);
    grad.addColorStop(0, 'rgba(220,38,38,0.22)');
    grad.addColorStop(0.45, 'rgba(220,38,38,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // subtle vertical falloff at top + bottom
    const top = ctx.createLinearGradient(0, 0, 0, 400);
    top.addColorStop(0, 'rgba(0,0,0,0.5)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 400);
  }

  function drawPhoneShadow(ctx, tiltDeg = 0) {
    ctx.save();
    ctx.translate(PHONE_CX, PHONE_TOP + PHONE_H/2);
    if (tiltDeg) ctx.rotate(tiltDeg * Math.PI / 180);
    ctx.translate(-PHONE_CX, -(PHONE_TOP + PHONE_H/2));
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.filter = 'blur(50px)';
    roundRectPath(ctx, PHONE_CX - PHONE_W/2, PHONE_TOP + 50, PHONE_W, PHONE_H, PHONE_R_OUT);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
  }

  function drawPhoneFrame(ctx, screenImg, options = {}) {
    const { tilt = 0, statusTime = '9:41' } = options;

    // Apply tilt
    ctx.save();
    if (tilt) {
      // 3D-ish: rotate around phone center then squish horizontally
      ctx.translate(PHONE_CX, PHONE_TOP + PHONE_H/2);
      ctx.transform(Math.cos(tilt * Math.PI/180), 0, 0, 1, 0, 0);
      ctx.translate(-PHONE_CX, -(PHONE_TOP + PHONE_H/2));
    }

    // Bezel — gradient
    const bezelGrad = ctx.createLinearGradient(
      PHONE_CX - PHONE_W/2, PHONE_TOP,
      PHONE_CX + PHONE_W/2, PHONE_TOP + PHONE_H
    );
    bezelGrad.addColorStop(0,    '#5e5e62');
    bezelGrad.addColorStop(0.25, '#3a3a3e');
    bezelGrad.addColorStop(0.5,  '#1d1d20');
    bezelGrad.addColorStop(0.75, '#353539');
    bezelGrad.addColorStop(1,    '#56565a');

    ctx.fillStyle = bezelGrad;
    roundRectPath(ctx, PHONE_CX - PHONE_W/2, PHONE_TOP, PHONE_W, PHONE_H, PHONE_R_OUT);
    ctx.fill();

    // Outer highlight
    ctx.strokeStyle = '#7a7a80';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dark ring
    ctx.strokeStyle = '#0e0e10';
    ctx.lineWidth = 2.5;
    roundRectPath(ctx, PHONE_CX - PHONE_W/2 + 3, PHONE_TOP + 3, PHONE_W - 6, PHONE_H - 6, PHONE_R_OUT - 3);
    ctx.stroke();

    // Screen (black bg)
    ctx.fillStyle = '#000';
    roundRectPath(ctx, SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H, PHONE_R_IN);
    ctx.fill();

    // Clip to screen for content
    ctx.save();
    roundRectPath(ctx, SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H, PHONE_R_IN);
    ctx.clip();

    // Draw the app source image — fit (preserve aspect, top-align)
    const srcRatio = screenImg.width / screenImg.height;
    const dstRatio = SCREEN_W / SCREEN_H;
    let drawW, drawH;
    if (srcRatio > dstRatio) {
      // source wider → fit width, content shorter than screen → black bottom
      drawW = SCREEN_W;
      drawH = SCREEN_W / srcRatio;
    } else {
      // source taller → fit height, content narrower → black sides
      drawH = SCREEN_H;
      drawW = SCREEN_H * srcRatio;
    }
    const dx = SCREEN_X + (SCREEN_W - drawW) / 2;
    const dy = SCREEN_Y;  // top-align
    ctx.drawImage(screenImg, dx, dy, drawW, drawH);

    // Clean status bar overlay (covers source's original status bar)
    const sbGrad = ctx.createLinearGradient(0, SCREEN_Y, 0, SCREEN_Y + STATUS_H);
    sbGrad.addColorStop(0, '#000');
    sbGrad.addColorStop(0.65, '#000');
    sbGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sbGrad;
    ctx.fillRect(SCREEN_X, SCREEN_Y, SCREEN_W, STATUS_H);

    // 9:41 + icons
    drawStatusBar(ctx, SCREEN_X, SCREEN_Y, SCREEN_W, STATUS_H, statusTime);

    // Dynamic island
    const diW = 250, diH = 56;
    const diX = PHONE_CX - diW/2;
    const diY = SCREEN_Y + 26;
    ctx.fillStyle = '#000';
    roundRectPath(ctx, diX, diY, diW, diH, diH/2);
    ctx.fill();

    ctx.restore(); // unclip
    ctx.restore(); // untilt
  }

  function drawStatusBar(ctx, x, y, w, h, time) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '600 36px -apple-system, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(time, x + 64, y + 56);

    // Right side: signal bars + 5G + battery
    let rx = x + w - 30; // right margin
    // Battery (right-most)
    const batW = 60, batH = 28, batY = y + 56 - batH/2;
    rx -= batW;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, rx, batY, batW, batH, 7);
    ctx.stroke();
    // Battery tip
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(rx + batW + 1, batY + 10, 3, 8);
    // Battery fill
    ctx.fillStyle = '#fff';
    roundRectPath(ctx, rx + 4, batY + 4, batW - 8, batH - 8, 4);
    ctx.fill();

    rx -= 18;
    // "5G"
    ctx.font = '600 30px -apple-system, "Helvetica Neue", sans-serif';
    const m5g = ctx.measureText('5G');
    rx -= m5g.width;
    ctx.fillStyle = '#fff';
    ctx.fillText('5G', rx, y + 56);

    rx -= 14;
    // Signal bars (4 ascending)
    const barW = 6, barG = 4;
    const heights = [9, 14, 19, 24];
    for (let i = heights.length - 1; i >= 0; i--) {
      rx -= barW;
      ctx.fillStyle = '#fff';
      const bh = heights[i];
      ctx.fillRect(rx, y + 56 - bh/2 + bh/2 - bh, barW, bh);
      // Position: align bottoms
      ctx.clearRect(rx, y + 56 - bh/2 + bh/2 - bh, 0, 0); // no-op
    }
    // Redraw signal bars correctly
    // (Reset and draw aligned to common bottom)
    ctx.fillStyle = '#fff';
    let sigX = x + w - 30 - batW - 18 - m5g.width - 14;
    for (let i = heights.length - 1; i >= 0; i--) {
      sigX -= barW;
      const bh = heights[i];
      // We need to undo the bad earlier draws; easier: clear column then redraw
    }
    ctx.restore();

    // Cleaner re-draw of signal bars: clear a region first
    ctx.save();
    const sigRegionX = x + w - 30 - batW - 18 - m5g.width - 14 - (barW + barG) * 4 - 10;
    const sigRegionW = (barW + barG) * 4 + 20;
    // Clear status bar bg first behind icons
    // (skip — overdraw with bars on top is fine since black bg)
    ctx.fillStyle = '#fff';
    let sx = x + w - 30 - batW - 18 - m5g.width - 14;
    for (let i = heights.length - 1; i >= 0; i--) {
      sx -= barW;
      const bh = heights[i];
      const by = y + 56 + 14 - bh; // bottom aligned at y+70
      ctx.fillRect(sx, by, barW, bh);
      sx -= barG;
    }
    ctx.restore();
  }

  /* ---------- text helpers ---------- */
  function setHeadlineFont(ctx, size) {
    ctx.font = `400 ${size}px Anton, "Bebas Neue", Impact, sans-serif`;
  }
  function setSubheadFont(ctx, size, weight = 500) {
    ctx.font = `${weight} ${size}px Inter, -apple-system, "Helvetica Neue", sans-serif`;
  }

  // Draw text with mixed colors & underline accents.
  // Lines = [ {segments: [{text, color?, underline?: 'red'|'gold'}], dotAfter?: 'red' } ]
  function drawHeadline(ctx, lines, opts) {
    const { topY, size, lineHeight = 0.95, letterSpacing = 0 } = opts;
    setHeadlineFont(ctx, size);
    ctx.textBaseline = 'alphabetic';

    const lineH = size * lineHeight;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      // Compute total width to center
      let totalW = 0;
      const segWidths = line.segments.map(s => {
        const w = ctx.measureText(s.text).width + s.text.length * letterSpacing;
        totalW += w;
        return w;
      });
      // dotAfter adds a dot circle of size ~ 0.18 * size
      const dotR = line.dotAfter ? size * 0.09 : 0;
      const dotGap = line.dotAfter ? size * 0.06 : 0;
      const totalWithDot = totalW + (line.dotAfter ? dotGap + dotR * 2 : 0);

      let x = (W - totalWithDot) / 2;
      const y = topY + li * lineH + size * 0.85; // baseline

      // Draw each segment
      for (let si = 0; si < line.segments.length; si++) {
        const seg = line.segments[si];
        ctx.fillStyle = seg.color || '#fff';
        ctx.fillText(seg.text, x, y);
        // Underline
        if (seg.underline) {
          const uColor = seg.underline === 'gold' ? GOLD : RED;
          ctx.fillStyle = uColor;
          const uy = y + size * 0.04;
          ctx.fillRect(x + 2, uy, segWidths[si] - 4, size * 0.055);
        }
        x += segWidths[si];
      }
      // Red dot
      if (line.dotAfter) {
        ctx.fillStyle = line.dotAfter === 'gold' ? GOLD : RED;
        ctx.beginPath();
        ctx.arc(x + dotGap + dotR, y - size * 0.05, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSubhead(ctx, text, opts) {
    const { topY, size = 34, color = MUTED, maxWidth = 980 } = opts;
    setSubheadFont(ctx, size, 500);
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    // Manual word wrap
    const words = text.split(' ');
    const lines = [];
    let curr = '';
    for (const w of words) {
      const t = curr ? curr + ' ' + w : w;
      const tw = ctx.measureText(t).width;
      if (tw > maxWidth && curr) {
        lines.push(curr);
        curr = w;
      } else {
        curr = t;
      }
    }
    if (curr) lines.push(curr);

    const lineH = size * 1.38;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i];
      const tw = ctx.measureText(t).width;
      ctx.fillText(t, (W - tw)/2, topY + i * lineH + size * 0.85);
    }
    return topY + lines.length * lineH;
  }

  /* ---------- accent helpers ---------- */
  function drawClaudeBadge(ctx, y) {
    setSubheadFont(ctx, 22, 500);
    const label = '  Powered by Claude';
    const tw = ctx.measureText(label).width;
    const padX = 22, padY = 10;
    const totalW = tw + padX * 2 + 14;
    const x = (W - totalW) / 2;
    const h = 50;
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, x, y, totalW, h, h/2);
    ctx.stroke();
    // Dot
    ctx.fillStyle = '#cc785c';
    ctx.beginPath();
    ctx.arc(x + padX + 7, y + h/2, 7, 0, Math.PI * 2);
    ctx.fill();
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + padX, y + h/2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function drawBubble(ctx) {
    // Speech bubble for shot 3 — positioned right side of phone over combo card
    const bx = 940, by = 1820, bw = 360, bh = 200;
    const r = 22;

    ctx.save();
    ctx.translate(bx + bw/2, by + bh/2);
    ctx.rotate(-3 * Math.PI / 180);
    ctx.translate(-(bx + bw/2), -(by + bh/2));

    // Glow
    ctx.shadowColor = 'rgba(220,38,38,0.35)';
    ctx.shadowBlur = 30;

    // Body
    ctx.fillStyle = '#0a0a0a';
    roundRectPath(ctx, bx, by, bw, bh, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3;
    roundRectPath(ctx, bx, by, bw, bh, r);
    ctx.stroke();

    // Tail (pointing left into phone)
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.moveTo(bx + 4, by + 80);
    ctx.lineTo(bx - 24, by + 92);
    ctx.lineTo(bx + 4, by + 110);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + 4, by + 80);
    ctx.lineTo(bx - 24, by + 92);
    ctx.lineTo(bx + 4, by + 110);
    ctx.stroke();
    // Cover join with phone-side line
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(bx + 3, by + 81, 4, 30);

    // Text
    setHeadlineFont(ctx, 38);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    // play icon
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.moveTo(bx + 28, by + 50);
    ctx.lineTo(bx + 28, by + 80);
    ctx.lineTo(bx + 50, by + 65);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText('JAB. CROSS.', bx + 64, by + 76);
    ctx.fillText('LEAD HOOK.', bx + 28, by + 120);
    ctx.fillText('CROSS.', bx + 28, by + 164);

    ctx.restore();
  }

  function drawSigLine(ctx) {
    setSubheadFont(ctx, 20, 500);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.textBaseline = 'alphabetic';
    const text = 'PUNCHPAL  ·  V1.1';
    // letter spacing manually
    ctx.save();
    const spaced = text.split('').join('\u200a\u200a');
    const tw = ctx.measureText(spaced).width;
    ctx.fillText(spaced, (W - tw)/2, H - 36);
    ctx.restore();
  }

  /* ---------- per-shot composer ---------- */
  function composeShot(spec, srcImg) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    drawBackground(ctx);
    drawPhoneFrame(ctx, srcImg, { tilt: spec.tilt || 0 });

    if (spec.headline) drawHeadline(ctx, spec.headline, { topY: 140, size: 116 });
    if (spec.subhead) {
      const subY = 140 + spec.headline.length * 116 * 0.95 + 56;
      drawSubhead(ctx, spec.subhead, { topY: subY });
      if (spec.badge === 'claude') {
        const after = 140 + spec.headline.length * 116 * 0.95 + 56 + 34 * 1.38 * 2 + 16;
        drawClaudeBadge(ctx, after);
      }
    }
    if (spec.bubble) drawBubble(ctx);
    if (spec.sigLine) drawSigLine(ctx);

    return c;
  }

  /* ---------- specs ---------- */
  const SPECS = [
    {
      name: '01_home.png',
      src: 'src/home.png',
      headline: [
        { segments: [
          { text: 'A REAL ' },
          { text: 'BOXING', underline: 'red' },
          { text: ' COACH.' },
        ] },
        { segments: [{ text: 'IN YOUR POCKET' }], dotAfter: 'red' },
      ],
      subhead: 'A fresh AI workout in three seconds. Hit start. Improve.',
    },
    {
      name: '02_workout_engine.png',
      src: 'src/loading.png',
      tilt: 0,  // no canvas tilt — done outside the phone-frame draw if needed
      headline: [
        { segments: [{ text: 'EVERY WORKOUT.' }] },
        { segments: [
          { text: 'BUILT FROM ' },
          { text: 'SCRATCH', underline: 'red' },
          { text: '.' },
        ] },
      ],
      subhead: 'A unique session every time you tap “Get Fresh Workout.”',
      badge: 'claude',
    },
    {
      name: '03_timer.png',
      src: 'src/timer.png',
      headline: [
        { segments: [{ text: 'REAL PRO MECHANICS.' }] },
        { segments: [
          { text: 'CALLED ' },
          { text: 'OUT LOUD', underline: 'red' },
          { text: '.' },
        ] },
      ],
      subhead: 'Slip. Counter. Pivot. The phone coaches you so your eyes stay forward.',
      bubble: true,
    },
    {
      name: '04_rating.png',
      src: 'src/rating.png',
      headline: [
        { segments: [{ text: 'RATE EVERY ROUND.' }] },
        { segments: [
          { text: 'THE AI GETS ' },
          { text: 'SMARTER', underline: 'red' },
          { text: '.' },
        ] },
      ],
      subhead: 'Too easy, just right, or too hard. Your feedback rewrites the next workout.',
    },
    {
      name: '05_profile.png',
      src: 'src/profile.png',
      tilt: 0,
      headline: [
        { segments: [{ text: 'NEVER MISS' }] },
        { segments: [
          { text: 'A ' },
          { text: 'DAY', color: GOLD, underline: 'gold' },
          { text: '.' },
        ] },
      ],
      subhead: 'Streaks, training stats, and nine progression tiers from beginner to pro.',
    },
    {
      name: '06_free_forever.png',
      src: 'src/home.png',
      headline: [
        { segments: [
          { text: 'FREE', color: '#DC2626' },
          { text: ' FOREVER.' },
        ] },
        { segments: [{ text: 'NO PAYWALL' }], dotAfter: 'red' },
      ],
      subhead: 'No subscription. No premium tier. Just boxing.',
      sigLine: true,
    },
  ];

  /* ---------- run ---------- */
  for (const spec of SPECS) {
    log('rendering ' + spec.name);
    const img = await readImage(spec.src);
    const canvas = composeShot(spec, img);
    await saveFile('exports/' + spec.name, canvas);
    log('saved ' + spec.name);
  }
}
window.__renderAll = renderAll;
