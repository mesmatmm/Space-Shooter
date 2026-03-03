/* ============================================================
   Star Assault — game.js
   Vanilla JS + Canvas space shooter
   ============================================================ */

'use strict';

// ── Canvas setup ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

const CANVAS_W = 480;
const CANVAS_H = 720;
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

// ── Game states ───────────────────────────────────────────────
const STATE = { START: 'start', PLAY: 'play', GAMEOVER: 'gameover' };
let gameState = STATE.START;

// ── DOM refs ──────────────────────────────────────────────────
const startScreen   = document.getElementById('start-screen');
const gameoverScreen= document.getElementById('gameover-screen');
const hud           = document.getElementById('hud');
const btnPlay       = document.getElementById('btn-play');
const btnRetry      = document.getElementById('btn-retry');
const btnMenu       = document.getElementById('btn-menu');
const btnMusicStart = document.getElementById('btn-music');
const btnMusicHud   = document.getElementById('hud-music-toggle');
const hudScore      = document.getElementById('hud-score');
const hudLevel      = document.getElementById('hud-level');
const hudLives      = document.getElementById('hud-lives');
const finalScore    = document.getElementById('final-score');
const finalHs       = document.getElementById('final-hs');
const hsDisplay     = document.getElementById('hs-display');

// ── High score (localStorage) ─────────────────────────────────
let highScore = parseInt(localStorage.getItem('starAssaultHS') || '0', 10);
hsDisplay.textContent = highScore;

// ════════════════════════════════════════════════════════════════
//  AUDIO ENGINE  (Web Audio API — no external files needed)
// ════════════════════════════════════════════════════════════════
let audioCtx = null;
let musicOn  = true;
let musicGain, musicOsc1, musicOsc2;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

/** Play a short synthesized sound effect */
function playSound(type) {
  if (!musicOn && type === 'music') return;
  const ac = getAudioCtx();
  const gain = ac.createGain();
  gain.connect(ac.destination);

  const osc = ac.createOscillator();
  osc.connect(gain);

  switch (type) {
    case 'shoot':
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ac.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.12);
      break;

    case 'explode':
      // noise-like burst via rapid frequency change
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.25);
      gain.gain.setValueAtTime(0.3, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.25);
      break;

    case 'hit': // player hit
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.3);
      gain.gain.setValueAtTime(0.35, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.3);
      break;

    case 'levelup':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ac.currentTime);
      osc.frequency.linearRampToValueAtTime(880, ac.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.3);
      break;
  }
}

/** Simple generative background music loop */
function startMusic() {
  if (!musicOn) return;
  const ac = getAudioCtx();
  if (musicGain) return; // already running

  musicGain = ac.createGain();
  musicGain.gain.value = 0.08;
  musicGain.connect(ac.destination);

  musicOsc1 = ac.createOscillator();
  musicOsc1.type = 'sine';
  musicOsc1.frequency.value = 110;
  musicOsc1.connect(musicGain);
  musicOsc1.start();

  musicOsc2 = ac.createOscillator();
  musicOsc2.type = 'triangle';
  musicOsc2.frequency.value = 165;
  musicOsc2.connect(musicGain);
  musicOsc2.start();

  // Slowly modulate pitch for ambient feel
  let t = 0;
  function modulate() {
    if (!musicGain) return;
    t += 0.02;
    musicOsc1.frequency.value = 110 + Math.sin(t) * 10;
    musicOsc2.frequency.value = 165 + Math.cos(t * 0.7) * 15;
    setTimeout(modulate, 50);
  }
  modulate();
}

function stopMusic() {
  if (musicGain) {
    musicGain.disconnect();
    musicOsc1.stop();
    musicOsc2.stop();
    musicGain = null;
    musicOsc1 = null;
    musicOsc2 = null;
  }
}

function toggleMusic() {
  musicOn = !musicOn;
  btnMusicStart.textContent = `🎵 Music: ${musicOn ? 'ON' : 'OFF'}`;
  btnMusicHud.textContent   = musicOn ? '🎵' : '🔇';
  if (musicOn) startMusic();
  else stopMusic();
}

// ════════════════════════════════════════════════════════════════
//  STAR FIELD (parallax background)
// ════════════════════════════════════════════════════════════════
const STAR_LAYERS = [
  { count: 60, speed: 0.4, size: 1,   alpha: 0.4 },
  { count: 30, speed: 0.9, size: 1.5, alpha: 0.6 },
  { count: 15, speed: 1.8, size: 2,   alpha: 0.9 },
];
const stars = [];

function initStars() {
  stars.length = 0;
  STAR_LAYERS.forEach(layer => {
    for (let i = 0; i < layer.count; i++) {
      stars.push({
        x:     Math.random() * CANVAS_W,
        y:     Math.random() * CANVAS_H,
        speed: layer.speed,
        size:  layer.size,
        alpha: layer.alpha,
      });
    }
  });
}

function updateStars() {
  stars.forEach(s => {
    s.y += s.speed;
    if (s.y > CANVAS_H) { s.y = 0; s.x = Math.random() * CANVAS_W; }
  });
}

function drawStars() {
  stars.forEach(s => {
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
  ctx.globalAlpha = 1;
}

// ════════════════════════════════════════════════════════════════
//  PARTICLES
// ════════════════════════════════════════════════════════════════
const particles = [];

function spawnExplosion(x, y, color = '#ff8833', count = 18) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.03 + Math.random() * 0.04,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05; // slight gravity
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ════════════════════════════════════════════════════════════════
//  GAME ENTITIES
// ════════════════════════════════════════════════════════════════

// ── Player ────────────────────────────────────────────────────
const player = {
  w: 44, h: 52,
  x: CANVAS_W / 2,
  y: CANVAS_H - 90,
  speed: 5,
  lives: 3,
  score: 0,
  level: 1,
  invincibleFrames: 0,
  shootCooldown: 0,
  SHOOT_RATE: 14, // frames between shots
};

function resetPlayer() {
  player.x = CANVAS_W / 2;
  player.y = CANVAS_H - 90;
  player.lives = 3;
  player.score = 0;
  player.level = 1;
  player.invincibleFrames = 0;
  player.shootCooldown = 0;
}

/** Draw player ship using canvas paths (no sprites needed) */
function drawPlayer() {
  if (player.invincibleFrames > 0 && Math.floor(player.invincibleFrames / 4) % 2 === 0) return;

  const x = player.x;
  const y = player.y;
  const w = player.w;
  const h = player.h;

  ctx.save();

  // Engine glow
  const glowGrad = ctx.createRadialGradient(x, y + h * 0.4, 2, x, y + h * 0.4, 22);
  glowGrad.addColorStop(0, 'rgba(0,180,255,0.7)');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.4, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main body
  ctx.fillStyle = '#00aaee';
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);           // nose
  ctx.lineTo(x + w / 2, y + h / 2);   // bottom-right
  ctx.lineTo(x, y + h / 2 - 12);      // center notch
  ctx.lineTo(x - w / 2, y + h / 2);   // bottom-left
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = '#aaf';
  ctx.beginPath();
  ctx.ellipse(x, y, 8, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings
  ctx.fillStyle = '#0077bb';
  // Left wing
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 10);
  ctx.lineTo(x - w / 2 - 10, y + h / 2);
  ctx.lineTo(x - 8, y + h / 2 - 10);
  ctx.closePath();
  ctx.fill();
  // Right wing
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 10);
  ctx.lineTo(x + w / 2 + 10, y + h / 2);
  ctx.lineTo(x + 8, y + h / 2 - 10);
  ctx.closePath();
  ctx.fill();

  // Thruster flame
  const flicker = 4 + Math.random() * 6;
  const flameGrad = ctx.createLinearGradient(x, y + h / 2 - 4, x, y + h / 2 + flicker);
  flameGrad.addColorStop(0, '#00eeff');
  flameGrad.addColorStop(0.5, '#ff8800');
  flameGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + h / 2 - 4);
  ctx.lineTo(x, y + h / 2 + flicker);
  ctx.lineTo(x + 8, y + h / 2 - 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ── Bullets ───────────────────────────────────────────────────
const bullets = [];

function fireBullet() {
  if (player.shootCooldown > 0) return;
  player.shootCooldown = player.SHOOT_RATE;
  bullets.push({
    x: player.x,
    y: player.y - player.h / 2 + 6,
    w: 4, h: 16,
    speed: 12,
  });
  playSound('shoot');
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= bullets[i].speed;
    if (bullets[i].y + bullets[i].h < 0) bullets.splice(i, 1);
  }
}

function drawBullets() {
  bullets.forEach(b => {
    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#00eeff');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(b.x - b.w / 2, b.y, b.w, b.h, 2);
    ctx.fill();
  });
}

// ── Enemies ───────────────────────────────────────────────────
const enemies = [];
let enemySpawnTimer = 0;

const ENEMY_TYPES = [
  // type, color, hp, points, w, h, speed multiplier
  { type: 'scout',    color: '#ff4444', hp: 1, pts: 10,  w: 36, h: 32, sm: 1.0 },
  { type: 'fighter',  color: '#ff8800', hp: 2, pts: 25,  w: 44, h: 38, sm: 0.8 },
  { type: 'bomber',   color: '#cc00ff', hp: 4, pts: 60,  w: 56, h: 48, sm: 0.55 },
];

function getSpawnRate() {
  // frames between spawns — decreases with level (min 28)
  return Math.max(28, 90 - (player.level - 1) * 7);
}

function getEnemySpeed() {
  return 1.4 + (player.level - 1) * 0.25;
}

function spawnEnemy() {
  // Weight enemy type by level
  let pool = [ENEMY_TYPES[0]]; // always scouts
  if (player.level >= 2) pool.push(ENEMY_TYPES[1]);
  if (player.level >= 4) pool.push(ENEMY_TYPES[2]);
  // Add extra scouts to keep them common
  pool = [...pool, ENEMY_TYPES[0], ENEMY_TYPES[0]];

  const tmpl = pool[Math.floor(Math.random() * pool.length)];
  const baseSpeed = getEnemySpeed() * tmpl.sm;

  enemies.push({
    x: tmpl.w / 2 + Math.random() * (CANVAS_W - tmpl.w),
    y: -tmpl.h / 2,
    w: tmpl.w,
    h: tmpl.h,
    hp: tmpl.hp,
    maxHp: tmpl.hp,
    pts: tmpl.pts,
    color: tmpl.color,
    type: tmpl.type,
    speed: baseSpeed,
    // slight horizontal wobble
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp:   Math.random() * 1.2,
  });
}

function updateEnemies(frame) {
  enemySpawnTimer++;
  if (enemySpawnTimer >= getSpawnRate()) {
    enemySpawnTimer = 0;
    spawnEnemy();
    // chance of double spawn at higher levels
    if (player.level >= 3 && Math.random() < 0.3) spawnEnemy();
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += e.speed;
    e.x += Math.sin(frame * 0.04 + e.wobblePhase) * e.wobbleAmp;
    e.x = Math.max(e.w / 2, Math.min(CANVAS_W - e.w / 2, e.x));

    // Off-screen below
    if (e.y - e.h / 2 > CANVAS_H) {
      enemies.splice(i, 1);
    }
  }
}

/** Draw a stylised enemy ship for each type */
function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  // Health bar
  if (e.maxHp > 1) {
    const barW = e.w;
    const filled = (e.hp / e.maxHp) * barW;
    ctx.fillStyle = '#333';
    ctx.fillRect(-barW / 2, -e.h / 2 - 8, barW, 4);
    ctx.fillStyle = e.hp > e.maxHp / 2 ? '#44ff66' : '#ff4444';
    ctx.fillRect(-barW / 2, -e.h / 2 - 8, filled, 4);
  }

  // Ship body (flipped orientation = pointing down)
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.moveTo(0, e.h / 2);            // nose (bottom)
  ctx.lineTo(-e.w / 2, -e.h / 2);
  ctx.lineTo(0, -e.h / 2 + 10);
  ctx.lineTo(e.w / 2, -e.h / 2);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = 'rgba(255,200,200,0.6)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glow outline
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawEnemies() {
  enemies.forEach(e => drawEnemy(e));
}

// ── Enemy bullets ─────────────────────────────────────────────
const enemyBullets = [];
let enemyShootTimer = 0;

function getEnemyShootRate() {
  return Math.max(40, 130 - (player.level - 1) * 15);
}

function enemyShoot(frame) {
  enemyShootTimer++;
  if (enemyShootTimer < getEnemyShootRate()) return;
  enemyShootTimer = 0;

  if (enemies.length === 0) return;
  // Pick the lowest enemy (closest to player)
  const shooter = enemies.reduce((best, e) => e.y > best.y ? e : best, enemies[0]);
  enemyBullets.push({
    x: shooter.x,
    y: shooter.y + shooter.h / 2,
    speed: 5 + player.level * 0.4,
  });
}

function updateEnemyBullets() {
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    enemyBullets[i].y += enemyBullets[i].speed;
    if (enemyBullets[i].y > CANVAS_H + 10) enemyBullets.splice(i, 1);
  }
}

function drawEnemyBullets() {
  enemyBullets.forEach(b => {
    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + 14);
    grad.addColorStop(0, '#ff4444');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(b.x - 3, b.y - 14, 6, 14, 2);
    ctx.fill();
  });
}

// ── Power-ups ─────────────────────────────────────────────────
const powerups = [];
let powerupTimer = 0;
const POWERUP_INTERVAL = 600; // frames

const POWERUP_TYPES = [
  { type: 'life',      color: '#ff66aa', label: '♥', desc: '+1 Life' },
  { type: 'rapid',     color: '#ffcc00', label: '⚡', desc: 'Rapid Fire' },
  { type: 'shield',    color: '#44aaff', label: '🛡', desc: 'Shield' },
];

function spawnPowerup() {
  const tmpl = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push({
    x: 20 + Math.random() * (CANVAS_W - 40),
    y: -20,
    ...tmpl,
    speed: 2,
    pulseT: 0,
  });
}

function updatePowerups() {
  powerupTimer++;
  if (powerupTimer >= POWERUP_INTERVAL) { powerupTimer = 0; spawnPowerup(); }

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += p.speed;
    p.pulseT += 0.1;
    if (p.y > CANVAS_H + 20) powerups.splice(i, 1);
  }
}

function drawPowerups() {
  powerups.forEach(p => {
    const pulse = 0.8 + 0.2 * Math.sin(p.pulseT);
    ctx.save();
    ctx.globalAlpha = 0.9;

    // Glow
    const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 22 * pulse);
    glow.addColorStop(0, p.color + 'cc');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Icon circle
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = `${14 * pulse}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, p.x, p.y);

    ctx.restore();
  });
}

// ── Active power-up effects ───────────────────────────────────
let rapidFireTimer = 0;
let shieldActive   = false;
let shieldTimer    = 0;

function applyPowerup(type) {
  switch (type) {
    case 'life':
      if (player.lives < 5) { player.lives++; updateHUD(); }
      break;
    case 'rapid':
      rapidFireTimer = 300; // 5 seconds @ 60fps
      player.SHOOT_RATE = 5;
      break;
    case 'shield':
      shieldActive = true;
      shieldTimer  = 360; // 6 seconds
      break;
  }
  showFloatingText('+' + POWERUP_TYPES.find(p => p.type === type).desc, player.x, player.y - 40, '#ffcc00');
}

function updatePowerupEffects() {
  if (rapidFireTimer > 0) {
    rapidFireTimer--;
    if (rapidFireTimer === 0) player.SHOOT_RATE = 14;
  }
  if (shieldTimer > 0) {
    shieldTimer--;
    if (shieldTimer === 0) shieldActive = false;
  }
}

function drawShield() {
  if (!shieldActive) return;
  const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.008);
  ctx.save();
  ctx.globalAlpha = 0.35 * pulse;
  ctx.strokeStyle = '#44aaff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.1 * pulse;
  ctx.fillStyle = '#44aaff';
  ctx.fill();
  ctx.restore();
}

// ── Floating text ─────────────────────────────────────────────
const floatingTexts = [];

function showFloatingText(text, x, y, color = '#fff') {
  floatingTexts.push({ text, x, y, color, life: 1, vy: -1.2 });
}

function updateFloatingTexts() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y  += ft.vy;
    ft.life -= 0.018;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

function drawFloatingTexts() {
  floatingTexts.forEach(ft => {
    ctx.save();
    ctx.globalAlpha = ft.life;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });
}

// ════════════════════════════════════════════════════════════════
//  COLLISION DETECTION  (AABB)
// ════════════════════════════════════════════════════════════════
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax - aw / 2 < bx + bw / 2 &&
         ax + aw / 2 > bx - bw / 2 &&
         ay - ah / 2 < by + bh / 2 &&
         ay + ah / 2 > by - bh / 2;
}

function checkCollisions() {
  // Player bullets vs enemies
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (rectOverlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) {
        bullets.splice(bi, 1);
        e.hp--;
        if (e.hp <= 0) {
          spawnExplosion(e.x, e.y, e.color);
          playSound('explode');
          player.score += e.pts;
          showFloatingText(`+${e.pts}`, e.x, e.y, '#ffff88');
          enemies.splice(ei, 1);
          checkLevelUp();
          updateHUD();
        }
        break;
      }
    }
  }

  // Enemy bullets vs player
  if (player.invincibleFrames === 0) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (rectOverlap(b.x, b.y, 6, 14, player.x, player.y, player.w, player.h)) {
        enemyBullets.splice(i, 1);
        if (shieldActive) {
          shieldTimer = 0; shieldActive = false;
          showFloatingText('Shield Broken!', player.x, player.y - 40, '#44aaff');
        } else {
          damagePlayer();
        }
      }
    }
  }

  // Enemies vs player (ram)
  if (player.invincibleFrames === 0) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (rectOverlap(e.x, e.y, e.w, e.h, player.x, player.y, player.w, player.h)) {
        spawnExplosion(e.x, e.y, e.color, 12);
        playSound('explode');
        enemies.splice(i, 1);
        if (shieldActive) {
          shieldTimer = 0; shieldActive = false;
          showFloatingText('Shield Broken!', player.x, player.y - 40, '#44aaff');
        } else {
          damagePlayer();
        }
      }
    }
  }

  // Powerups vs player
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    if (rectOverlap(p.x, p.y, 28, 28, player.x, player.y, player.w, player.h)) {
      applyPowerup(p.type);
      powerups.splice(i, 1);
    }
  }
}

function damagePlayer() {
  player.lives--;
  playSound('hit');
  spawnExplosion(player.x, player.y, '#00aaff', 10);
  player.invincibleFrames = 120;
  updateHUD();
  if (player.lives <= 0) endGame();
}

// ── Level progression ─────────────────────────────────────────
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000];

function checkLevelUp() {
  const next = LEVEL_THRESHOLDS[player.level];
  if (next !== undefined && player.score >= next) {
    player.level++;
    playSound('levelup');
    showFloatingText(`LEVEL ${player.level}!`, CANVAS_W / 2, CANVAS_H / 2, '#ffff00');
  }
}

// ════════════════════════════════════════════════════════════════
//  INPUT
// ════════════════════════════════════════════════════════════════
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup',   e => { keys[e.code] = false; });

// Touch support
let touchX = null;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  touchX = e.touches[0].clientX;
  // Any tap also fires a bullet
  if (gameState === STATE.PLAY) fireBullet();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  touchX = e.touches[0].clientX;
}, { passive: false });

canvas.addEventListener('touchend', () => { touchX = null; });

function processInput() {
  const spd = player.speed + (player.level > 1 ? 0 : 0);

  if (keys['ArrowLeft']  || keys['KeyA']) player.x -= spd;
  if (keys['ArrowRight'] || keys['KeyD']) player.x += spd;

  // Touch drag
  if (touchX !== null) {
    const rect = canvas.getBoundingClientRect();
    const ratio = CANVAS_W / rect.width;
    const targetX = (touchX - rect.left) * ratio;
    const dx = targetX - player.x;
    player.x += Math.sign(dx) * Math.min(Math.abs(dx), spd * 2);
  }

  // Clamp
  player.x = Math.max(player.w / 2, Math.min(CANVAS_W - player.w / 2, player.x));

  // Shoot
  if (keys['Space'] || keys['ArrowUp'] || keys['KeyW']) fireBullet();

  if (player.shootCooldown > 0) player.shootCooldown--;
}

// ════════════════════════════════════════════════════════════════
//  HUD HELPERS
// ════════════════════════════════════════════════════════════════
function updateHUD() {
  hudScore.textContent = `Score: ${player.score}`;
  hudLevel.textContent = `Level: ${player.level}`;
  hudLives.textContent = '❤'.repeat(player.lives);
}

// ════════════════════════════════════════════════════════════════
//  GAME STATE TRANSITIONS
// ════════════════════════════════════════════════════════════════
function startGame() {
  resetPlayer();
  bullets.length = 0;
  enemies.length = 0;
  enemyBullets.length = 0;
  powerups.length = 0;
  particles.length = 0;
  floatingTexts.length = 0;
  enemySpawnTimer = 0;
  enemyShootTimer = 0;
  powerupTimer    = 0;
  rapidFireTimer  = 0;
  shieldActive    = false;
  shieldTimer     = 0;

  initStars();
  updateHUD();

  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  gameState = STATE.PLAY;
  getAudioCtx(); // unlock audio
  startMusic();
}

function endGame() {
  gameState = STATE.GAMEOVER;

  if (player.score > highScore) {
    highScore = player.score;
    localStorage.setItem('starAssaultHS', highScore);
    hsDisplay.textContent = highScore;
  }

  finalScore.textContent = player.score;
  finalHs.textContent    = highScore;

  hud.classList.add('hidden');
  gameoverScreen.classList.remove('hidden');
}

function goToMenu() {
  gameState = STATE.START;
  hud.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  hsDisplay.textContent = highScore;
  initStars();
}

// ════════════════════════════════════════════════════════════════
//  DRAW HUD ON CANVAS (level badge)
// ════════════════════════════════════════════════════════════════
function drawHUDCanvas() {
  // Shield bar
  if (shieldActive) {
    const pct = shieldTimer / 360;
    ctx.fillStyle = 'rgba(68,170,255,0.3)';
    ctx.fillRect(0, CANVAS_H - 6, CANVAS_W * pct, 6);
  }
  // Rapid fire bar
  if (rapidFireTimer > 0) {
    const pct = rapidFireTimer / 300;
    ctx.fillStyle = 'rgba(255,204,0,0.5)';
    ctx.fillRect(0, CANVAS_H - 10, CANVAS_W * pct, 4);
  }
}

// ════════════════════════════════════════════════════════════════
//  MAIN GAME LOOP
// ════════════════════════════════════════════════════════════════
let frame = 0;

function loop() {
  requestAnimationFrame(loop);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, '#00001a');
  bg.addColorStop(1, '#000510');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars always scroll
  updateStars();
  drawStars();

  if (gameState === STATE.PLAY) {
    frame++;

    processInput();
    updateBullets();
    updateEnemies(frame);
    enemyShoot(frame);
    updateEnemyBullets();
    updatePowerups();
    updateParticles();
    updatePowerupEffects();
    updateFloatingTexts();
    checkCollisions();

    if (player.invincibleFrames > 0) player.invincibleFrames--;

    drawBullets();
    drawEnemies();
    drawEnemyBullets();
    drawPowerups();
    drawParticles();
    drawShield();
    drawPlayer();
    drawFloatingTexts();
    drawHUDCanvas();
  }
}

// ════════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════════════════════════════
btnPlay.addEventListener('click', startGame);
btnRetry.addEventListener('click', startGame);
btnMenu.addEventListener('click',  goToMenu);
btnMusicStart.addEventListener('click', toggleMusic);
btnMusicHud.addEventListener('click',  toggleMusic);

// Keyboard shortcuts on overlays
window.addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    if (gameState === STATE.START)    startGame();
    if (gameState === STATE.GAMEOVER) startGame();
  }
  if (e.code === 'Escape' && gameState === STATE.GAMEOVER) goToMenu();
});

// ── roundRect polyfill (Safari < 15.4, older browsers) ───────
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r, Math.min(w, h) / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.arcTo(x + w, y, x + w, y + r, r);
    this.lineTo(x + w, y + h - r);
    this.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.lineTo(x + r, y + h);
    this.arcTo(x, y + h, x, y + h - r, r);
    this.lineTo(x, y + r);
    this.arcTo(x, y, x + r, y, r);
    this.closePath();
  };
}

// ── Bootstrap ─────────────────────────────────────────────────
initStars();
loop();
