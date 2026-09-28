import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

// --- WEB AUDIO API ENGINE ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const actx = new AudioContext();

const playSound = (type) => {
  if (actx.state === 'suspended') actx.resume();
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.connect(gain);
  gain.connect(actx.destination);
  const now = actx.currentTime;
  
  if (type === 'shoot') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'hit') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(800, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);
    osc.start(now); osc.stop(now + 0.15);
  } else if (type === 'miss') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now); osc.stop(now + 0.3);
  } else if (type === 'round_start') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.setValueAtTime(400, now + 0.1);
    osc.frequency.setValueAtTime(500, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
  } else if (type === 'laugh') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.2);
    osc.frequency.setValueAtTime(280, now + 0.25);
    osc.frequency.linearRampToValueAtTime(130, now + 0.45);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.6);
    osc.start(now); osc.stop(now + 0.6);
  } else if (type === 'easter_egg') {
    // Magical ascending arpeggio
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      const o2 = actx.createOscillator();
      const g2 = actx.createGain();
      o2.connect(g2); g2.connect(actx.destination);
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(freq, now + i * 0.09);
      g2.gain.setValueAtTime(0.18, now + i * 0.09);
      g2.gain.linearRampToValueAtTime(0, now + i * 0.09 + 0.25);
      o2.start(now + i * 0.09); o2.stop(now + i * 0.09 + 0.3);
    });
  }
};

// --- SPRITES ---
const CELL = 3; 
const ACROBAT_SWING = [
  ".....RR.....",
  "....RRRR....",
  "...RWWWRR...",
  "...RRRRRR...",
  "....RBRB....",
  "...RRBBBRR..",
  "..R.BBBBB.R.",
  "..R..BBB..R.",
  ".....R.R....",
  "....RR.RR...",
  "...RR...RR.."
];
const VIGILANTE_STAND = [
  "......FFFF......",
  ".....FFFFFF.....",
  ".....FKKKKF.....",
  ".....FFFFFF.....",
  "...KKKKKKKKKK...",
  "..KKKWWKKWWKKK..",
  "..KKKKWWWWKKKK..",
  "...KKKKWWKKKK...",
  "....KKK..KKK....",
  "....KK....KK...."
];
const DRONE_SPRITE = [
  "..K......K..",
  ".K.KKKKKK.K.",
  "K..KRRRRK..K",
  "KKKKRWWKKKKK",
  "...KKKKKK..."
];

const PALETTES = {
  acrobat: { R: '#e23636', B: '#1a1a1a', W: '#ffffff' },
  vigilante: { F: '#ffcda8', K: '#111111', W: '#ffffff' },
  drone: { K: '#222222', R: '#ff3333', W: '#ffff00' }
};

const drawGrid = (ctx, x, y, grid, palette, flip=false, scale=1) => {
  const H = grid.length, W = grid[0].length;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.translate(-(W*CELL*scale)/2, -(H*CELL*scale)/2); 
  for (let r=0; r<H; r++) {
    for (let c=0; c<W; c++) {
      const ch = grid[r][c];
      if (ch !== '.') {
        ctx.fillStyle = palette[ch];
        ctx.fillRect(c*CELL*scale, r*CELL*scale, CELL*scale, CELL*scale);
      }
    }
  }
  ctx.restore();
};

const MISS_TAUNTS = [
  "CANT YOU DO IT MAN?",
  "A 3 YEAR OLD COULD HAVE PLAYED BETTER!",
  "STORMTRUPER AIM!",
  "WAS THAT A WARNING SHOT?",
  "IS YOUR MOUSE BROKEN?",
  "OPEN YOUR EYES, MAN!",
  "EVEN I COULD HIT THAT!",
  "MY GRANDMA AIMS BETTER!",
  "ARE YOU PLAYING WITH YOUR FEET?",
  "WAKE UP, HERO!",
  "I'VE SEEN BETTER AIM FROM A POTATO.",
  "YOU'RE SHOOTING BLANKS!",
  "PACIFIST RUN?",
  "YOU CALL THAT AN ATTACK?"
];

const GAME_OVER_TAUNTS = [
  "OH COOL YOU HAVE FINALLY ENDED YOUR BROS LOVE STORY.",
  "WITH GREAT POWER COMES TERRIBLE AIM.",
  "THE REAL PUNISHMENT IS YOUR SCORE.",
  "SPIDEY: 1, YOU: 0.",
  "DONT QUIT YOUR DAY JOB.",
  "THE CITY IS DOOMED THANKS TO YOU.",
  "BACK TO TRAINING WHEELS FOR YOU.",
  "MAYBE TRY MINESWEEPER INSTEAD?",
  "EVEN J. JONAH JAMESON IS DISAPPOINTED.",
  "YOU LET THEM GET AWAY! THE RENT IS STILL DUE!"
];

// --- GAME LOGIC ENGINE ---
class GameEngine {
  constructor(canvas, updateReactState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.updateReactState = updateReactState;
    
    // Internal logical resolution (16:9)
    this.W = 800; this.H = 450;
    this.canvas.width = this.W; this.canvas.height = this.H;
    
    this.state = 'MENU'; 
    this.mode = 1; // 1=EASY, 2=MEDIUM, 3=HARD
    
    this.score = 0;
    this.hiScore = parseInt(localStorage.getItem('retroweb_hi')) || 0;
    this.round = 1;
    this.ammo = 5;
    this.maxAmmo = 5;
    
    this.targets = [];
    this.particles = [];
    this.floatingTexts = []; 
    this.history = new Array(10).fill('empty');
    this.targetsSpawned = 0;
    this.shotsFired = 0;
    this.currentCombo = 0; 
    this.gameOverTaunt = "";

    // Building occlusion rects — populated in draw(), used in shoot()
    // Each entry: { x, y, w, h }  (canvas logical coords)
    this.buildingRects = [];

    // ── Easter egg ──────────────────────────────────────────────────
    // Fixed position on the 5th building (the tall cyan tower at x:332)
    // Sits just below its billboard, blending with the window row.
    this.easterEgg = { x: 388, y: 195, r: 9, found: false };
    this.eggPulse = 0; // drives the subtle shimmer animation
    
    this.mascot = { active: false, y: this.H, type: 'laugh', timer: 0 };
    
    this.lastTime = performance.now();
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  startGame(mode) {
    this.mode = mode;
    this.score = 0;
    this.round = 1;
    this.currentCombo = 0;
    this.gameOverTaunt = "";
    this.easterEgg.found = false; // reset so it can be found again next game
    
    // Determine Max Ammo based on Difficulty Level
    if (this.mode === 1) this.maxAmmo = 5; // Easy
    else if (this.mode === 2) this.maxAmmo = 4; // Medium
    else this.maxAmmo = 3; // Hard
    
    this.startRound();
  }

  startRound() {
    this.history = new Array(10).fill('empty');
    this.targetsSpawned = 0;
    this.targets = [];
    this.particles = [];
    this.floatingTexts = [];
    this.state = 'ROUND_START';
    this.syncState();
    playSound('round_start');
    
    setTimeout(() => {
      if (this.state === 'ROUND_START') {
        this.state = 'PLAYING';
        this.spawnWave();
      }
    }, 1500);
  }

  spawnWave() {
    this.ammo = this.maxAmmo;
    this.targets = [];
    
    // Targets per wave based on Difficulty Level
    let count = 1;
    if (this.mode === 2) count = 2; // Medium: 2 acrobats
    if (this.mode === 3) count = 2; // Hard: acrobat + drone mix
    
    for (let i=0; i<count; i++) {
      if (this.mode === 3 && i === 1) {
        this.targets.push(this.createDrone());
      } else {
        this.targets.push(this.createAcrobat());
      }
    }
    this.targetsSpawned += count;
    this.syncState();
  }

  // --- ENTITY CREATION ---
  createAcrobat() {
    // Huge difficulty tweaks here based on level
    let speedMult = 0.5 + (this.round * 0.05); // EASY base speed
    if (this.mode === 2) speedMult = 0.8 + (this.round * 0.05); // MEDIUM
    if (this.mode === 3) speedMult = 1.2 + (this.round * 0.1); // HARD
    
    const dir = Math.random() > 0.5 ? 1 : -1;
    const startY = 150 + Math.random() * 100; 
    
    return {
      type: 'acrobat',
      x: dir === 1 ? -80 : this.W + 80,
      y: startY,
      baseY: startY,
      vx: (140 + Math.random() * 40) * speedMult * dir, 
      amplitude: 140 + Math.random() * 50, // Massive swing down to bottom third of screen
      phase: Math.random() * Math.PI,
      phaseSpeed: (2.0 + Math.random()) * speedMult,
      dead: false,
      escaped: false,
      escapeTimer: 0,
      speedGlitched: false,
      freezeTimer: 0,
      freezeCount: 0,
      // More forgiving screen time on easy
      maxTime: this.mode === 1 ? 5.0 : Math.max(1.5, 4.0 - (this.round * 0.2)) 
    };
  }

  createDrone() {
    let speedMult = 1.0 + (this.round * 0.1);
    const dir = Math.random() > 0.5 ? 1 : -1;
    return {
      type: 'drone',
      x: dir === 1 ? -40 : this.W + 40,
      y: this.H * 0.5 + (Math.random() * 120 - 60), 
      vx: (160 + Math.random() * 60) * speedMult * dir,
      vy: (-20 - Math.random() * 30) * speedMult,
      scale: 2.5,
      dead: false,
      escaped: false,
      escapeTimer: 0,
      speedGlitched: false,
      freezeTimer: 0,
      freezeCount: 0,
      maxTime: Math.max(1.5, 3.5 - (this.round * 0.15))
    };
  }

  // --- INPUT ---
  shoot(x, y) {
    if (this.state !== 'PLAYING') return;
    if (this.ammo <= 0) return;

    // Block shot if click is inside a foreground building (target is occluded)
    const blocked = this.buildingRects.some(
      r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    );
    if (blocked) return;

    // ── Easter egg hit check (before spending ammo, doesn't cost a shot) ──
    if (!this.easterEgg.found) {
      const eg = this.easterEgg;
      if (Math.hypot(x - eg.x, y - eg.y) < eg.r + 8) {
        eg.found = true;
        this.score += 500;
        if (this.score > this.hiScore) {
          this.hiScore = this.score;
          localStorage.setItem('retroweb_hi', this.hiScore);
        }
        playSound('easter_egg');
        // Golden screen flash
        const flashEl = document.getElementById('screen-flash');
        if (flashEl) {
          flashEl.style.background = '#ffd700';
          flashEl.style.opacity = '0.55';
          setTimeout(() => {
            flashEl.style.opacity = '0';
            setTimeout(() => { flashEl.style.background = '#fff'; }, 400);
          }, 180);
        }
        // Floating celebration texts on canvas
        this.floatingTexts.push({ x: eg.x, y: eg.y - 20, text: '+500 SECRET BONUS!', color: '#ffd700', life: 3.5, isTaunt: false, isEgg: true });
        this.floatingTexts.push({ x: eg.x, y: eg.y - 44, text: 'EASTER EGG FOUND!',  color: '#ffffff', life: 3.5, isTaunt: false, isEgg: true });
        // Spawn golden particle burst
        this.spawnExplosion(eg.x, eg.y, '#ffd700');
        // Notify React for the achievement overlay
        this.syncState();
        return; // finding the egg doesn't cost a shot
      }
    }

    this.ammo--;
    this.shotsFired++;
    playSound('shoot');
    
    const flashEl = document.getElementById('screen-flash');
    if (flashEl) {
      flashEl.style.opacity = '0.4';
      setTimeout(() => flashEl.style.opacity = '0', 50);
    }

    let hitAnything = false;

    // Difficulty based hit boxes
    let radiusMult = 1.0;
    if (this.mode === 1) radiusMult = 1.5; // Huge hit boxes for Easy
    if (this.mode === 3) radiusMult = 0.8; // Small hit boxes for Hard

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.dead || t.escaped) continue;
      
      const baseRadius = t.type === 'drone' ? 24 * t.scale : 32; 
      const radius = baseRadius * radiusMult;
      const dist = Math.hypot(t.x - x, t.y - y);
      
      if (dist < radius) {
        t.dead = true;
        hitAnything = true;
        this.currentCombo++;
        playSound('hit');
        
        const basePts = (t.type === 'drone' ? 1000 : 500) + (this.round * 100);
        const comboMult = this.currentCombo > 1 ? this.currentCombo : 1;
        const totalPts = basePts * comboMult;
        
        this.score += totalPts;
        if (this.score > this.hiScore) {
          this.hiScore = this.score;
          localStorage.setItem('retroweb_hi', this.hiScore);
        }
        
        this.floatingTexts.push({ x: t.x, y: t.y - 30, text: `+${totalPts}`, color: '#f1c40f', life: 1.2, isTaunt: false });
        if (this.currentCombo > 1) {
            this.floatingTexts.push({ x: t.x, y: t.y - 50, text: `${this.currentCombo}X COMBO!`, color: '#e23636', life: 1.5, isTaunt: false });
        }

        this.spawnExplosion(t.x, t.y, t.type === 'drone' ? '#ff3333' : '#e23636');
        
        const idx = this.targetsSpawned - this.targets.length + i;
        if (idx < 10) this.history[idx] = 'hit';
        break; 
      }
    }

    if (!hitAnything) {
        playSound('miss');
        this.currentCombo = 0; 
        
        // Clear previous taunts to prevent unreadable overlaps
        this.floatingTexts = this.floatingTexts.filter(ft => !ft.isTaunt);
        const taunt = MISS_TAUNTS[Math.floor(Math.random() * MISS_TAUNTS.length)];
        
        // Spawn taunt in the upper center of the screen
        this.floatingTexts.push({
          x: this.W / 2, y: this.H / 3, text: taunt, color: '#ff6b6b', life: 2.5, isTaunt: true
        });
    }
    
    this.checkWaveEnd();
    this.syncState();
  }

  checkWaveEnd() {
    const allDead = this.targets.every(t => t.dead);
    const allEscaped = this.targets.every(t => t.escaped || t.dead);
    
    if ((this.ammo === 0 && allEscaped) || allEscaped || allDead) {
      setTimeout(() => this.endWave(), 600);
    }
  }

  endWave() {
    if (this.state !== 'PLAYING') return;
    
    let caughtCount = this.targets.filter(t => t.dead).length;
    
    if (this.targets.length > 0 && this.targets.some(t => t.escaped && !t.dead)) {
       this.currentCombo = 0; 
       this.targets.forEach((t, i) => {
         if (t.escaped && !t.dead) {
           const idx = this.targetsSpawned - this.targets.length + i;
           if (idx < 10) this.history[idx] = 'miss';
         }
       });
    }

    this.state = 'END_ANIM';
    this.mascot.active = true;
    this.mascot.y = this.H;
    this.mascot.timer = 0;
    
    if (caughtCount > 0) {
      this.mascot.type = 'stand';
    } else {
      this.mascot.type = 'laugh';
      playSound('laugh');
    }
    this.syncState();
  }

  spawnExplosion(x, y, color) {
    for(let i=0; i<30; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random()-0.5)*350,
        vy: (Math.random()-0.5)*350,
        life: 1.0,
        color: Math.random()>0.5 ? color : '#ffffff'
      });
    }
  }

  // --- LOOP & RENDERING ---
  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    
    this.update(dt);
    this.draw();
    
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (this.state === 'PLAYING') {
      let activeCount = 0;
      
      this.targets.forEach(t => {
        if (t.dead) {
          t.y += 500 * dt; 
          return;
        }
        if (t.escaped) return;
        
        t.escapeTimer += dt;
        if (t.escapeTimer > t.maxTime || t.x < -150 || t.x > this.W + 150 || t.y < -150) {
          t.escaped = true;
          this.checkWaveEnd();
        }

        // Speed and freeze logic removed (were causing gameplay bugs)

        if (t.type === 'acrobat') {
          t.x += t.vx * dt;
          t.phase += t.phaseSpeed * dt;
          t.y = t.baseY + Math.sin(t.phase) * t.amplitude;
        } else if (t.type === 'drone') {
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          t.scale = Math.max(0.5, t.scale - 0.5 * dt); 
        }
        activeCount++;
      });
      
      if (this.ammo === 0 && activeCount > 0) {
        this.targets.forEach(t => { if(!t.dead) t.escapeTimer += dt * 5; });
      }
    }

    if (this.state === 'END_ANIM') {
      this.mascot.timer += dt;
      if (this.mascot.timer < 0.5) this.mascot.y -= 150 * dt; 
      else if (this.mascot.timer > 2.0) this.mascot.y += 150 * dt; 
      
      if (this.mascot.timer > 2.5) {
        this.mascot.active = false;
        if (this.targetsSpawned >= 10) this.checkRoundClear();
        else { this.state = 'PLAYING'; this.spawnWave(); }
      }
    }

    this.particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.5;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    this.floatingTexts.forEach(ft => {
      ft.y -= (ft.isTaunt ? 5 : 45) * dt;
      ft.life -= dt;
    });
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);

    // Animate egg shimmer
    this.eggPulse += dt * 2.8;
  }

  checkRoundClear() {
    const hits = this.history.filter(h => h === 'hit').length;
    // Progression requirements scaled by difficulty
    let required = 5 + Math.floor(this.round / 2);
    if (this.mode === 1) required -= 1; // Easier to pass on easy mode
    required = Math.min(required, 10);
    
    if (hits >= required) {
      this.round++;
      this.startRound();
    } else {
      this.state = 'GAME_OVER';
      this.gameOverTaunt = GAME_OVER_TAUNTS[Math.floor(Math.random() * GAME_OVER_TAUNTS.length)];
      this.syncState();
    }
  }

  draw() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const GROUND = H - 75; // y where ground begins

    // ═══════════════════════════════════════════════════════════════
    // 1. MIDNIGHT SKY
    // ═══════════════════════════════════════════════════════════════
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,    '#03010a');
    sky.addColorStop(0.45, '#08052a');
    sky.addColorStop(1,    '#0d0635');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // ── Stars (deterministic, no flicker) ───────────────────────────
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 120; i++) {
      const sx = ((Math.sin(i * 127.1) * 0.5 + 0.5) * W) | 0;
      const sy = ((Math.cos(i * 311.7) * 0.5 + 0.5) * (H * 0.72)) | 0;
      const sz = (Math.sin(i * 53.3) * 0.5 + 0.5);
      ctx.globalAlpha = 0.4 + sz * 0.6;
      const r = sz > 0.75 ? 1.5 : 1;
      ctx.fillRect(sx, sy, r, r);
    }
    ctx.globalAlpha = 1;

    // ── Moon ────────────────────────────────────────────────────────
    const moonX = W - 120, moonY = 65, moonR = 38;
    // outer glow
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 3.2);
    moonGlow.addColorStop(0,   'rgba(220, 210, 180, 0.18)');
    moonGlow.addColorStop(1,   'rgba(220, 210, 180, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 3.2, 0, Math.PI * 2); ctx.fill();
    // disc
    const moonDisc = ctx.createRadialGradient(moonX - 8, moonY - 8, 4, moonX, moonY, moonR);
    moonDisc.addColorStop(0, '#fffde0');
    moonDisc.addColorStop(1, '#d4c98a');
    ctx.fillStyle = moonDisc;
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
    // crater details
    ctx.fillStyle = 'rgba(160,140,80,0.28)';
    [[8, -10, 7], [-12, 8, 5], [14, 12, 4], [-5, -18, 3]].forEach(([cx, cy, cr]) => {
      ctx.beginPath(); ctx.arc(moonX + cx, moonY + cy, cr, 0, Math.PI * 2); ctx.fill();
    });

    // ── City horizon haze ────────────────────────────────────────────
    const haze = ctx.createLinearGradient(0, GROUND - 60, 0, GROUND);
    haze.addColorStop(0, 'rgba(30,10,80,0)');
    haze.addColorStop(1, 'rgba(60,20,120,0.45)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, GROUND - 60, W, 60);

    // ═══════════════════════════════════════════════════════════════
    // 2. FAR BACKGROUND BUILDINGS (silhouette layer)
    // ═══════════════════════════════════════════════════════════════
    const farBldgs = [
      { x:   0, w: 55, h:  85 }, { x:  50, w: 40, h: 105 },
      { x:  85, w: 65, h:  70 }, { x: 145, w: 45, h:  92 },
      { x: 188, w: 60, h:  78 }, { x: 245, w: 38, h: 100 },
      { x: 280, w: 50, h:  88 }, { x: 328, w: 42, h:  72 },
      { x: 368, w: 55, h:  95 }, { x: 420, w: 48, h:  82 },
      { x: 465, w: 60, h:  68 }, { x: 522, w: 52, h: 108 },
      { x: 570, w: 65, h:  75 }, { x: 632, w: 44, h:  98 },
      { x: 672, w: 58, h:  85 }, { x: 728, w: 40, h:  90 },
      { x: 765, w: 45, h:  72 },
    ];
    ctx.fillStyle = '#0a0520';
    farBldgs.forEach(b => ctx.fillRect(b.x, GROUND - b.h, b.w, b.h));

    // Sparse far-building windows (tiny, warm)
    farBldgs.forEach(b => {
      for (let wy = GROUND - b.h + 8; wy < GROUND - 10; wy += 12) {
        for (let wx = b.x + 5; wx < b.x + b.w - 8; wx += 10) {
          if ((wx * 3 + wy * 7) % 9 > 5) {
            ctx.fillStyle = 'rgba(255, 200, 80, 0.55)';
            ctx.fillRect(wx, wy, 3, 4);
          }
        }
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // 3. TARGETS (drawn BEFORE foreground buildings so they go behind)
    // ═══════════════════════════════════════════════════════════════
    this.targets.forEach(t => {
      if (t.escaped && !t.dead) return;
      if (t.type === 'acrobat') {
        // web line
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(t.x + t.vx * 0.25, -200);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        if (!t.dead) drawGrid(ctx, t.x, t.y, ACROBAT_SWING, PALETTES.acrobat, t.vx > 0, 1.8);
      } else if (t.type === 'drone') {
        if (!t.dead) drawGrid(ctx, t.x, t.y, DRONE_SPRITE, PALETTES.drone, false, t.scale);
      }
    });

    // ── Particles ───────────────────────────────────────────────────
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(p.x, p.y, 5, 5);
    });
    ctx.globalAlpha = 1.0;

    // ═══════════════════════════════════════════════════════════════
    // 4. GROUND / ROAD
    // ═══════════════════════════════════════════════════════════════
    const groundGrad = ctx.createLinearGradient(0, GROUND, 0, H);
    groundGrad.addColorStop(0,   '#1a1030');
    groundGrad.addColorStop(0.3, '#120c22');
    groundGrad.addColorStop(1,   '#0a0618');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND, W, H - GROUND);

    // Road surface
    ctx.fillStyle = '#0e0c1e';
    ctx.fillRect(0, GROUND + 20, W, 35);

    // Road centre dashes — warm amber, like sodium streetlights
    ctx.fillStyle = 'rgba(255, 190, 60, 0.5)';
    for (let rx = 0; rx < W; rx += 55) ctx.fillRect(rx, GROUND + 35, 30, 3);

    // Kerb highlights
    ctx.fillStyle = 'rgba(100, 80, 200, 0.35)';
    ctx.fillRect(0, GROUND + 18, W, 3);
    ctx.fillRect(0, GROUND + 54, W, 2);

    // ═══════════════════════════════════════════════════════════════
    // 5. FOREGROUND BUILDINGS  — midnight neon-lit skyscrapers
    //    Also rebuilds this.buildingRects for occlusion
    // ═══════════════════════════════════════════════════════════════
    this.buildingRects = [];

    // Helper: draw a neon glow line along an edge
    const neonLine = (x1, y1, x2, y2, color, alpha = 0.7) => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const bldgs = [
      // x,   w,   h,   body,      neon,        style
      { x:   5, w: 70,  h: 165, body: '#0d0b1e', neon: '#00e5ff', style: 'tower'    },
      { x:  88, w: 52,  h: 120, body: '#0e0c1a', neon: '#ff4dff', style: 'flat'     },
      { x: 152, w: 95,  h: 205, body: '#09081c', neon: '#39ff14', style: 'stepped'  },
      { x: 260, w: 60,  h: 148, body: '#0c0b1e', neon: '#ff9500', style: 'flat'     },
      { x: 332, w: 118, h: 230, body: '#080618', neon: '#00e5ff', style: 'tower'    },
      { x: 462, w: 65,  h: 170, body: '#0d0b1e', neon: '#ff4dff', style: 'stepped'  },
      { x: 540, w: 58,  h: 130, body: '#0e0c1a', neon: '#39ff14', style: 'flat'     },
      { x: 610, w: 88,  h: 190, body: '#090818', neon: '#ff9500', style: 'tower'    },
      { x: 710, w: 85,  h: 155, body: '#0c0b1e', neon: '#00e5ff', style: 'flat'     },
    ];

    bldgs.forEach(b => {
      const bTop = GROUND - b.h;

      // Register occlusion rect (full body including any stepped top)
      const rectTop = b.style === 'stepped' ? bTop - 34 : (b.style === 'tower' ? bTop - 28 : bTop);
      this.buildingRects.push({ x: b.x, y: rectTop, w: b.w, h: H - rectTop });

      // ── Body ──────────────────────────────────────────────────────
      ctx.fillStyle = b.body;
      ctx.fillRect(b.x, bTop, b.w, b.h);

      // ── Style-specific topping ─────────────────────────────────────
      if (b.style === 'stepped') {
        const step = (b.w * 0.25) | 0;
        ctx.fillStyle = b.body;
        ctx.fillRect(b.x + step, bTop - 34, b.w - step * 2, 36);
        neonLine(b.x + step, bTop - 34, b.x + b.w - step, bTop - 34, b.neon);
        // antenna
        const ax = b.x + (b.w / 2) | 0;
        ctx.fillStyle = '#555';
        ctx.fillRect(ax - 1, bTop - 54, 3, 22);
        ctx.fillStyle = b.neon;
        ctx.shadowColor = b.neon; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(ax, bTop - 55, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      } else if (b.style === 'tower') {
        // Tapered top block
        const tp = (b.w * 0.18) | 0;
        ctx.fillStyle = b.body;
        ctx.fillRect(b.x + tp, bTop - 28, b.w - tp * 2, 30);
        neonLine(b.x + tp, bTop - 28, b.x + b.w - tp, bTop - 28, b.neon, 0.9);
        // spire
        const sx = b.x + (b.w / 2) | 0;
        ctx.fillStyle = '#666';
        ctx.fillRect(sx - 1, bTop - 48, 3, 22);
        ctx.fillStyle = '#ff2020';
        ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(sx, bTop - 50, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // flat — rooftop ledge + water tower silhouette
        ctx.fillStyle = '#181430';
        ctx.fillRect(b.x - 2, bTop - 6, b.w + 4, 8);
        // water tower
        const tx = b.x + (b.w * 0.72) | 0;
        ctx.fillStyle = '#0f0d24';
        ctx.fillRect(tx, bTop - 22, 14, 18);
        ctx.fillRect(tx - 2, bTop - 24, 18, 4);
      }

      // ── Neon edge trim ─────────────────────────────────────────────
      neonLine(b.x,         bTop, b.x,         GROUND, b.neon, 0.4);
      neonLine(b.x + b.w,   bTop, b.x + b.w,   GROUND, b.neon, 0.4);
      neonLine(b.x,         bTop, b.x + b.w,   bTop,   b.neon, 0.8);

      // ── Neon window glow grid ──────────────────────────────────────
      const winW = 7, winH = 9, padX = 9, padY = 12, gapX = 11, gapY = 13;
      for (let wy = bTop + padY; wy < GROUND - 8; wy += winH + gapY) {
        for (let wx = b.x + padX; wx < b.x + b.w - padX - winW; wx += winW + gapX) {
          const hash = (wx * 13 + wy * 7) % 17;
          if (hash > 6) {
            // lit window — warm yellow or neon tint
            const warm = hash > 11;
            ctx.fillStyle = warm ? 'rgba(255,210,80,0.75)' : `${b.neon}55`;
            ctx.shadowColor = warm ? '#ffcc44' : b.neon;
            ctx.shadowBlur  = warm ? 4 : 6;
            ctx.fillRect(wx, wy, winW, winH);
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(20,15,40,0.9)';
            ctx.fillRect(wx, wy, winW, winH);
          }
        }
      }
      ctx.shadowBlur = 0;

      // ── Billboard on taller buildings ─────────────────────────────
      if (b.h > 160 && b.w > 70) {
        const bx = b.x + 8, by = bTop + 22, bw = b.w - 16, bh = 22;
        ctx.fillStyle = '#000';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = b.neon;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = b.neon; ctx.shadowBlur = 6;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.shadowBlur = 0;
        ctx.fillStyle = b.neon;
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NYC', bx + bw / 2, by + 14);
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // 5b. GOLDEN SPIDER EASTER EGG
    //     Sits on the face of the large cyan tower (bldg index 4),
    //     just below its billboard — looks like a decorative emblem.
    // ═══════════════════════════════════════════════════════════════
    if (!this.easterEgg.found) {
      const eg = this.easterEgg;
      const pulse = Math.sin(this.eggPulse);
      const r = eg.r;

      ctx.save();
      ctx.translate(eg.x, eg.y);

      // Very subtle golden shimmer — dim enough to blend but findable
      const shimmerAlpha = 0.55 + pulse * 0.20;
      ctx.globalAlpha = shimmerAlpha;

      // Outer glow ring (very soft — looks like a window reflection)
      const glow = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.2);
      glow.addColorStop(0,   'rgba(255, 210, 0, 0.30)');
      glow.addColorStop(1,   'rgba(255, 210, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2); ctx.fill();

      // Body (small amber circle)
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur  = 6 + pulse * 4;
      ctx.fillStyle   = '#c8960a';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

      // Bright highlight
      ctx.fillStyle = '#ffe87a';
      ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.3, r * 0.38, 0, Math.PI * 2); ctx.fill();

      // 8 legs radiating outward (spider silhouette)
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth   = 1.2;
      ctx.shadowBlur  = 3;
      for (let leg = 0; leg < 8; leg++) {
        const angle  = (leg / 8) * Math.PI * 2;
        const legLen = r * 1.7;
        const midX   = Math.cos(angle) * r * 1.1;
        const midY   = Math.sin(angle) * r * 1.1;
        const tipX   = Math.cos(angle + 0.28) * legLen;
        const tipY   = Math.sin(angle + 0.28) * legLen;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * r * 0.85, Math.sin(angle) * r * 0.85);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.stroke();
      }

      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. STREET LEVEL — lamp posts + ground fog
    // ═══════════════════════════════════════════════════════════════
    // Lamp posts
    const lamps = [80, 200, 340, 470, 600, 730];
    lamps.forEach(lx => {
      // pole
      ctx.fillStyle = '#1a1830';
      ctx.fillRect(lx, GROUND - 32, 3, 32);
      // arm
      ctx.fillStyle = '#1a1830';
      ctx.fillRect(lx - 8, GROUND - 32, 12, 3);
      // light bulb
      ctx.fillStyle = '#fff8c0';
      ctx.shadowColor = '#ffee80';
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(lx - 8, GROUND - 32, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // cone of light on road
      const cone = ctx.createRadialGradient(lx - 8, GROUND - 28, 0, lx - 8, GROUND, 38);
      cone.addColorStop(0, 'rgba(255, 230, 80, 0.12)');
      cone.addColorStop(1, 'rgba(255, 230, 80, 0)');
      ctx.fillStyle = cone;
      ctx.fillRect(lx - 46, GROUND - 30, 80, 58);
    });

    // Ground fog strip
    const fog = ctx.createLinearGradient(0, GROUND + 45, 0, H);
    fog.addColorStop(0, 'rgba(40, 20, 80, 0.0)');
    fog.addColorStop(1, 'rgba(40, 20, 80, 0.5)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, GROUND + 45, W, H - GROUND - 45);

    // ═══════════════════════════════════════════════════════════════
    // 7. MASCOT
    // ═══════════════════════════════════════════════════════════════
    if (this.mascot.active) {
      const mY = Math.max(this.mascot.y, GROUND - 40);
      drawGrid(ctx, W / 2, mY, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
      if (this.mascot.type === 'laugh') {
        const bob = Math.sin(this.mascot.timer * 20) * 5;
        drawGrid(ctx, W / 2, mY + bob, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 8. FLOATING TEXTS
    // ═══════════════════════════════════════════════════════════════
    ctx.textAlign = 'center';
    this.floatingTexts.forEach(ft => {
      ctx.font = ft.isTaunt
        ? 'bold 15px "Press Start 2P", monospace'
        : '12px "Press Start 2P", monospace';
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life * 1.5));

      const textWidth = ctx.measureText(ft.text).width;
      const drawX = Math.max(textWidth / 2 + 20, Math.min(W - textWidth / 2 - 20, ft.x));

      if (ft.isTaunt) {
        ctx.fillStyle = 'rgba(5, 2, 20, 0.92)';
        ctx.fillRect(drawX - textWidth / 2 - 18, ft.y - 22, textWidth + 36, 32);
        ctx.strokeStyle = '#ff4dff';
        ctx.shadowColor  = '#ff4dff';
        ctx.shadowBlur   = 8;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(drawX - textWidth / 2 - 18, ft.y - 22, textWidth + 36, 32);
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle   = ft.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth   = 4;
      ctx.shadowColor = ft.isTaunt ? ft.color : 'transparent';
      ctx.shadowBlur  = ft.isTaunt ? 6 : 0;
      ctx.strokeText(ft.text, drawX, ft.y);
      ctx.fillText(ft.text, drawX, ft.y);
    });
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur  = 0;
  }

  syncState() {
    if (this.updateReactState) {
      this.updateReactState({
        state: this.state,
        score: this.score,
        hiScore: this.hiScore,
        round: this.round,
        ammo: this.ammo,
        maxAmmo: this.maxAmmo,
        history: [...this.history],
        mode: this.mode,
        gameOverTaunt: this.gameOverTaunt,
        eggFound: this.easterEgg.found,
      });
    }
  }

  destroy() {
    cancelAnimationFrame(this.reqId);
  }
}

// --- REACT APP COMPONENT ---
const App = () => {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  
  const [gameState, setGameState] = useState({
    state: 'MENU',
    score: 0,
    hiScore: parseInt(localStorage.getItem('retroweb_hi')) || 0,
    round: 1,
    ammo: 5,
    maxAmmo: 5,
    history: new Array(10).fill('empty'),
    mode: 1,
    gameOverTaunt: "",
    eggFound: false,
  });

  const initEngine = useCallback(() => {
    if (engineRef.current) engineRef.current.destroy();
    engineRef.current = new GameEngine(canvasRef.current, setGameState);
    setGameState(prev => ({...prev, hiScore: engineRef.current.hiScore}));
  }, []);

  useEffect(() => {
    initEngine();
    return () => { if (engineRef.current) engineRef.current.destroy(); };
  }, [initEngine]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const eng = engineRef.current;
      if (!eng) return;
      
      switch(e.key.toLowerCase()) {
        case '1': if(eng.state === 'MENU') eng.startGame(1); break;
        case '2': if(eng.state === 'MENU') eng.startGame(2); break;
        case '3': if(eng.state === 'MENU') eng.startGame(3); break;
        case 'r': eng.startGame(eng.mode); break;
        case 'escape': 
          eng.state = 'MENU';
          eng.syncState();
          break;
        case ' ': 
          if (eng.state === 'PLAYING') eng.shoot(400, 225); // Shoot center
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCanvasClick = (e) => {
    const eng = engineRef.current;
    if (!eng || eng.state !== 'PLAYING') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    eng.shoot(x, y);
  };

  const modeNames = { 1: 'EASY', 2: 'MEDIUM', 3: 'HARD' };
  const modeBadgeClass = { 1: 'badge-easy', 2: 'badge-medium', 3: 'badge-hard' };

  return (
    <div className="game-area">
      <canvas ref={canvasRef} onClick={handleCanvasClick} />
      <div className="crt-overlay" />
      <div id="screen-flash" className="flash" />

      {/* ── TOP HUD ───────────────────────────────────────────────── */}
      {gameState.state !== 'MENU' && (
        <div className="hud-top">
          <div className="hud-top-left">
            <span className="hud-wave">WAVE {gameState.round}</span>
            <span className={`hud-badge ${modeBadgeClass[gameState.mode]}`}>
              {modeNames[gameState.mode]}
            </span>
          </div>
          <div className="hud-top-right">
            <button
              className="btn"
              onClick={() => engineRef.current?.startGame(engineRef.current.mode)}
            >
              ↺ RESTART
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (engineRef.current) {
                  engineRef.current.state = 'MENU';
                  engineRef.current.syncState();
                }
              }}
            >
              ✕ MENU
            </button>
          </div>
        </div>
      )}

      {/* ── MENU ──────────────────────────────────────────────────── */}
      {gameState.state === 'MENU' && (
        <div className="overlay-screen">
          <div className="menu-card">
            <h1 className="title">RETRO WEB<br />HUNTER</h1>
            <p className="subtitle">Aim with mouse · Click or Space to shoot</p>
            <div className="menu-opts">
              <button className="menu-opt easy"   onClick={() => engineRef.current.startGame(1)}>
                <span className="opt-key">1</span> EASY
              </button>
              <button className="menu-opt medium" onClick={() => engineRef.current.startGame(2)}>
                <span className="opt-key">2</span> MEDIUM
              </button>
              <button className="menu-opt hard"   onClick={() => engineRef.current.startGame(3)}>
                <span className="opt-key">3</span> HARD
              </button>
            </div>
            {gameState.hiScore > 0 && (
              <p className="hi-score-display">BEST&nbsp; {gameState.hiScore.toString().padStart(6, '0')}</p>
            )}
          </div>
        </div>
      )}

      {/* ── WAVE BANNER ───────────────────────────────────────────── */}
      {gameState.state === 'ROUND_START' && (
        <div className="overlay-screen overlay-wave">
          <div className="wave-banner">
            <span className="wave-label">WAVE</span>
            <span className="wave-number">{gameState.round}</span>
          </div>
        </div>
      )}

      {/* ── GAME OVER ─────────────────────────────────────────────── */}
      {gameState.state === 'GAME_OVER' && (
        <div className="overlay-screen">
          <div className="menu-card">
            <h2 className="title gameover-title">GAME OVER</h2>
            <p className="score-display">{gameState.score.toString().padStart(6, '0')}</p>
            <p className="taunt-text">"{gameState.gameOverTaunt}"</p>
            <div className="menu-opts">
              <button className="menu-opt easy" onClick={() => engineRef.current.startGame(gameState.mode)}>
                ↺ TRY AGAIN
              </button>
              <button
                className="menu-opt"
                onClick={() => { engineRef.current.state = 'MENU'; engineRef.current.syncState(); }}
              >
                ← MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM HUD ────────────────────────────────────────────── */}
      {gameState.state !== 'MENU' && (
        <div className="hud-bottom">

          {/* Score block */}
          <div className="hud-scores">
            <div className="hud-score-row">
              <span className="hud-label">SCORE</span>
              <span className="hud-value">{gameState.score.toString().padStart(6, '0')}</span>
            </div>
            <div className="hud-score-row">
              <span className="hud-label">BEST</span>
              <span className="hud-value dim">{gameState.hiScore.toString().padStart(6, '0')}</span>
            </div>
          </div>

          {/* Hit history */}
          <div className="hud-history">
            {gameState.history.map((res, i) => (
              <div
                key={i}
                className={`hit-box ${res === 'hit' ? 'hit' : res === 'miss' ? 'miss' : ''}`}
              />
            ))}
          </div>

          {/* Ammo */}
          <div className="hud-ammo">
            <span className="hud-label">AMMO</span>
            <div className="ammo-container">
              {Array.from({ length: gameState.maxAmmo }).map((_, i) => (
                <div key={i} className={`bullet-icon ${i >= gameState.ammo ? 'spent' : ''}`} />
              ))}
            </div>
          </div>

        </div>
      )}
      {/* ── EASTER EGG ACHIEVEMENT TOAST ──────────────────────────── */}
      {gameState.eggFound && (
        <div className="egg-toast">
          <span className="egg-icon">🕷️</span>
          <div className="egg-text">
            <span className="egg-title">SECRET ACHIEVEMENT UNLOCKED</span>
            <span className="egg-sub">Friendly Neighborhood Bonus +500</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
