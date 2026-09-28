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

    // ── DAYTIME SKY GRADIENT ──────────────────────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, this.H);
    sky.addColorStop(0,   '#4fc3f7'); // bright sky blue at top
    sky.addColorStop(0.5, '#81d4fa'); // lighter mid sky
    sky.addColorStop(1,   '#b3e5fc'); // pale horizon
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.W, this.H);

    // ── SUN ──────────────────────────────────────────────────────────
    // Glow halo
    const sunX = 110, sunY = 70, sunR = 32;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 2.2);
    sunGlow.addColorStop(0,   'rgba(255, 236, 100, 0.55)');
    sunGlow.addColorStop(1,   'rgba(255, 236, 100, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 2.2, 0, Math.PI * 2); ctx.fill();
    // Sun disc
    ctx.fillStyle = '#FFE636';
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF176';
    ctx.beginPath(); ctx.arc(sunX - 6, sunY - 6, sunR * 0.45, 0, Math.PI * 2); ctx.fill();

    // ── CLOUDS ───────────────────────────────────────────────────────
    const drawCloud = (cx, cy, scale) => {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const puffs = [
        [0, 0, 28], [-26, 10, 20], [26, 10, 20], [-14, 14, 18], [14, 14, 18]
      ];
      puffs.forEach(([ox, oy, r]) => {
        ctx.beginPath();
        ctx.arc(cx + ox * scale, cy + oy * scale, r * scale, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    drawCloud(220, 55,  1.0);
    drawCloud(480, 40,  1.3);
    drawCloud(670, 70,  0.8);
    drawCloud(350, 90,  0.65);

    // ── DISTANT BACKGROUND BUILDINGS (hazy, light) ───────────────────
    const farBldgs = [
      { x: 0,   w: 60,  h: 90  },
      { x: 55,  w: 45,  h: 110 },
      { x: 95,  w: 70,  h: 75  },
      { x: 160, w: 50,  h: 95  },
      { x: 200, w: 65,  h: 80  },
      { x: 260, w: 40,  h: 100 },
      { x: 500, w: 55,  h: 95  },
      { x: 550, w: 70,  h: 70  },
      { x: 615, w: 45,  h: 105 },
      { x: 655, w: 60,  h: 85  },
      { x: 710, w: 50,  h: 90  },
      { x: 755, w: 45,  h: 75  },
    ];
    ctx.fillStyle = 'rgba(176, 213, 240, 0.6)';
    farBldgs.forEach(b => {
      ctx.fillRect(b.x, this.H - 80 - b.h, b.w, b.h);
    });

    // ── TARGETS ──────────────────────────────────────────────────────
    this.targets.forEach(t => {
      if (t.escaped && !t.dead) return;
      if (t.type === 'acrobat') {
        ctx.strokeStyle = 'rgba(60, 40, 20, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x + (t.vx * 0.3), -200);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        if (!t.dead) drawGrid(ctx, t.x, t.y, ACROBAT_SWING, PALETTES.acrobat, t.vx > 0, 1.8);
      } else if (t.type === 'drone') {
        if (!t.dead) drawGrid(ctx, t.x, t.y, DRONE_SPRITE, PALETTES.drone, false, t.scale);
      }
    });

    // ── PARTICLES ────────────────────────────────────────────────────
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(p.x, p.y, 5, 5);
    });
    ctx.globalAlpha = 1.0;

    // ── GROUND STRIP ─────────────────────────────────────────────────
    // Grass/pavement
    const ground = ctx.createLinearGradient(0, this.H - 80, 0, this.H);
    ground.addColorStop(0, '#5d8a3c');
    ground.addColorStop(0.35, '#4a7a2e');
    ground.addColorStop(1,   '#3a5e22');
    ctx.fillStyle = ground;
    ctx.fillRect(0, this.H - 80, this.W, 80);

    // Road line
    ctx.fillStyle = '#6b7a4a';
    ctx.fillRect(0, this.H - 46, this.W, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let rx = 20; rx < this.W; rx += 60) {
      ctx.fillRect(rx, this.H - 39, 30, 4);
    }

    // ── FOREGROUND BUILDINGS ──────────────────────────────────────────
    // Each building has: x, w, h, color, style ('flat'|'stepped'|'antenna')
    const bldgs = [
      { x: 10,  w: 75,  h: 155, color: '#e8d5b0', accent: '#c9b98a', style: 'flat'     },
      { x: 100, w: 55,  h: 110, color: '#b0c4d8', accent: '#8aaac2', style: 'stepped'  },
      { x: 165, w: 90,  h: 190, color: '#d4e3c3', accent: '#b0cc98', style: 'antenna'  },
      { x: 268, w: 65,  h: 140, color: '#f5e6c8', accent: '#d9c89a', style: 'flat'     },
      { x: 348, w: 110, h: 210, color: '#c8d8e8', accent: '#a0bcd0', style: 'stepped'  },
      { x: 472, w: 70,  h: 160, color: '#e0d0b8', accent: '#c4b090', style: 'antenna'  },
      { x: 555, w: 55,  h: 120, color: '#cce0cc', accent: '#a8c8a8', style: 'flat'     },
      { x: 622, w: 85,  h: 175, color: '#dce8f0', accent: '#b4cfe0', style: 'stepped'  },
      { x: 718, w: 82,  h: 145, color: '#f0dfc8', accent: '#d4bfa0', style: 'flat'     },
    ];

    bldgs.forEach(b => {
      const bTop = this.H - 80 - b.h;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(b.x + 6, bTop + 6, b.w, b.h);

      // Main body
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, bTop, b.w, b.h);

      // Accent stripe along top edge
      ctx.fillStyle = b.accent;
      ctx.fillRect(b.x, bTop, b.w, 8);

      // Stepped style: a narrower upper block
      if (b.style === 'stepped') {
        const step = Math.floor(b.w * 0.28);
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x + step, bTop - 28, b.w - step * 2, 30);
        ctx.fillStyle = b.accent;
        ctx.fillRect(b.x + step, bTop - 28, b.w - step * 2, 6);
      }

      // Antenna style: thin rod + small ball
      if (b.style === 'antenna') {
        const ax = b.x + Math.floor(b.w / 2);
        ctx.fillStyle = '#888';
        ctx.fillRect(ax - 2, bTop - 28, 4, 30);
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(ax, bTop - 30, 5, 0, Math.PI * 2); ctx.fill();
      }

      // Windows grid
      const winW = 8, winH = 10, padX = 10, padY = 14, gapX = 12, gapY = 14;
      for (let wy = bTop + padY; wy < this.H - 80 - padY; wy += winH + gapY) {
        for (let wx = b.x + padX; wx < b.x + b.w - padX - winW; wx += winW + gapX) {
          // Deterministic lit/unlit based on position
          const lit = ((Math.floor(wx) * 3 + Math.floor(wy) * 7) % 5) > 1;
          if (lit) {
            ctx.fillStyle = 'rgba(200, 230, 255, 0.85)'; // sky-reflected glass
          } else {
            ctx.fillStyle = 'rgba(100, 130, 160, 0.4)';  // darker glass
          }
          ctx.fillRect(wx, wy, winW, winH);
        }
      }

      // Rooftop AC units / ledge detail
      ctx.fillStyle = b.accent;
      ctx.fillRect(b.x + 4,      bTop + 10, 14, 8);
      ctx.fillRect(b.x + b.w - 18, bTop + 10, 14, 8);
    });

    // ── MASCOT ───────────────────────────────────────────────────────
    if (this.mascot.active) {
      const mY = Math.max(this.mascot.y, this.H - 120);
      drawGrid(ctx, this.W / 2, mY, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
      if (this.mascot.type === 'laugh') {
        const bob = Math.sin(this.mascot.timer * 20) * 5;
        drawGrid(ctx, this.W / 2, mY + bob, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
      }
    }

    // ── FLOATING TEXTS ───────────────────────────────────────────────
    ctx.textAlign = 'center';
    this.floatingTexts.forEach(ft => {
      ctx.font = ft.isTaunt
        ? 'bold 16px "Press Start 2P", monospace'
        : '13px "Press Start 2P", monospace';
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life * 1.5));

      const textWidth = ctx.measureText(ft.text).width;
      const drawX = Math.max(textWidth / 2 + 20, Math.min(this.W - textWidth / 2 - 20, ft.x));

      if (ft.isTaunt) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.fillRect(drawX - textWidth / 2 - 18, ft.y - 22, textWidth + 36, 32);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(drawX - textWidth / 2 - 18, ft.y - 22, textWidth + 36, 32);
      }

      ctx.fillStyle = ft.color;
      ctx.strokeStyle = ft.isTaunt ? 'rgba(0,0,0,0.15)' : '#000';
      ctx.lineWidth = ft.isTaunt ? 1 : 4;
      ctx.strokeText(ft.text, drawX, ft.y);
      ctx.fillText(ft.text, drawX, ft.y);
    });
    ctx.globalAlpha = 1.0;
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
        gameOverTaunt: this.gameOverTaunt
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
    gameOverTaunt: ""
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
    </div>
  );
};

export default App;
