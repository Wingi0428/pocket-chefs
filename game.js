(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    hud: document.getElementById('hud'),
    orders: document.getElementById('orders'),
    prompt: document.getElementById('prompt'),
    toast: document.getElementById('toast'),
    controls: document.getElementById('mobile-controls'),
    score: document.getElementById('score'),
    time: document.getElementById('time'),
    best: document.getElementById('best'),
    start: document.getElementById('start-screen'),
    tutorial: document.getElementById('tutorial-screen'),
    pause: document.getElementById('pause-screen'),
    end: document.getElementById('end-screen'),
    finalScore: document.getElementById('final-score'),
    stars: document.getElementById('stars'),
    resultMessage: document.getElementById('result-message')
  };

  const W = canvas.width;
  const H = canvas.height;
  const BEST_KEY = 'pocket-chefs-best-v1';
  const GAME_LENGTH = 150;

  const RECIPES = {
    tomato: { key: 'tomato', name: '番茄濃湯', emoji: '🍅🍅🍅', ingredient: 'tomato', color: '#e85d3d' },
    onion: { key: 'onion', name: '洋蔥濃湯', emoji: '🧅🧅🧅', ingredient: 'onion', color: '#d69d55' },
    mushroom: { key: 'mushroom', name: '森林菇湯', emoji: '🍄🍄🍄', ingredient: 'mushroom', color: '#9b705c' }
  };

  const INGREDIENTS = {
    tomato: { emoji: '🍅', name: '番茄', color: '#e95d46' },
    onion: { emoji: '🧅', name: '洋蔥', color: '#e3b865' },
    mushroom: { emoji: '🍄', name: '蘑菇', color: '#a77b61' }
  };

  const stations = [
    { id: 'tomato-crate', type: 'crate', ingredient: 'tomato', x: 48, y: 122, w: 92, h: 82, label: '番茄箱' },
    { id: 'onion-crate', type: 'crate', ingredient: 'onion', x: 48, y: 242, w: 92, h: 82, label: '洋蔥箱' },
    { id: 'mushroom-crate', type: 'crate', ingredient: 'mushroom', x: 48, y: 362, w: 92, h: 82, label: '蘑菇箱' },
    { id: 'board', type: 'board', x: 276, y: 72, w: 104, h: 78, label: '砧板', item: null, progress: 0 },
    { id: 'pot', type: 'pot', x: 486, y: 70, w: 108, h: 82, label: '湯鍋', ingredients: [], cook: 0, ready: false, burned: false, invalid: false, readyTimer: 0, bubble: 0 },
    { id: 'plates', type: 'plates', x: 718, y: 72, w: 94, h: 78, label: '盤子' },
    { id: 'serve', type: 'serve', x: 846, y: 252, w: 88, h: 118, label: '出餐口' },
    { id: 'trash', type: 'trash', x: 742, y: 514, w: 90, h: 82, label: '垃圾桶' },
    { id: 'assistant', type: 'assistant', x: 294, y: 516, w: 108, h: 76, label: '助手托盤', item: null },
    { id: 'counter-a', type: 'counter', x: 420, y: 260, w: 120, h: 78, label: '工作台' },
    { id: 'counter-b', type: 'counter', x: 420, y: 398, w: 120, h: 78, label: '工作台' }
  ];

  const colliders = stations.map(s => ({ x: s.x, y: s.y, w: s.w, h: s.h, station: s }));

  const player = {
    x: 670, y: 405, r: 22, speed: 190, facingX: 1, facingY: 0,
    carry: null, dashCooldown: 0, dashTimer: 0, step: 0
  };

  const helper = {
    x: 220, y: 475, targetX: 220, targetY: 475, phase: 'idle', timer: 2.5,
    carry: null, bob: 0, enabled: true
  };

  const input = {
    x: 0, y: 0, interactPressed: false, actionHeld: false, dashPressed: false,
    keys: new Set(), joyPointer: null
  };

  let game = {
    state: 'home', score: 0, best: Number(localStorage.getItem(BEST_KEY) || 0),
    timeLeft: GAME_LENGTH, orders: [], lastTime: performance.now(), particles: [],
    shake: 0, served: 0, missed: 0, combo: 0, comboTimer: 0
  };

  let audioCtx = null;
  let toastTimer = null;

  function initAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx?.state === 'suspended') audioCtx.resume();
  }

  function beep(freq = 520, duration = 0.08, type = 'sine', gain = 0.035) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function showToast(text, tone = 'normal') {
    ui.toast.textContent = text;
    ui.toast.style.background = tone === 'good' ? 'rgba(42,139,91,.96)' : tone === 'bad' ? 'rgba(184,62,49,.96)' : 'rgba(34,48,74,.96)';
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1250);
  }

  function randomRecipe() {
    const keys = Object.keys(RECIPES);
    return RECIPES[keys[Math.floor(Math.random() * keys.length)]];
  }

  function addOrder(initial = false) {
    const recipe = randomRecipe();
    game.orders.push({ id: crypto.randomUUID?.() || Math.random().toString(36), recipe, maxTime: initial ? 58 : 52, time: initial ? 58 : 52 });
  }

  function resetWorld() {
    player.x = 665; player.y = 405; player.carry = null; player.dashCooldown = 0; player.dashTimer = 0;
    helper.x = 220; helper.y = 475; helper.phase = 'idle'; helper.timer = 2.8; helper.carry = null;
    station('board').item = null; station('board').progress = 0;
    Object.assign(station('pot'), { ingredients: [], cook: 0, ready: false, burned: false, invalid: false, readyTimer: 0, bubble: 0 });
    station('assistant').item = null;
    game.score = 0; game.timeLeft = GAME_LENGTH; game.orders = []; game.particles = []; game.shake = 0;
    game.served = 0; game.missed = 0; game.combo = 0; game.comboTimer = 0;
    addOrder(true); addOrder(true); addOrder(true);
    updateHUD(); updateOrders();
  }

  function startGame() {
    initAudio();
    resetWorld();
    game.state = 'playing';
    ui.start.classList.remove('visible'); ui.pause.classList.remove('visible'); ui.end.classList.remove('visible');
    ui.hud.classList.remove('hidden'); ui.orders.classList.remove('hidden'); ui.controls.classList.remove('hidden');
    ui.prompt.classList.remove('hidden');
    game.lastTime = performance.now();
    beep(520, .08, 'triangle'); setTimeout(() => beep(680, .11, 'triangle'), 90);
  }

  function goHome() {
    game.state = 'home';
    ui.start.classList.add('visible'); ui.pause.classList.remove('visible'); ui.end.classList.remove('visible');
    ui.hud.classList.add('hidden'); ui.orders.classList.add('hidden'); ui.controls.classList.add('hidden'); ui.prompt.classList.add('hidden');
  }

  function pauseGame() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    ui.pause.classList.add('visible');
  }

  function resumeGame() {
    if (game.state !== 'paused') return;
    game.state = 'playing';
    ui.pause.classList.remove('visible');
    game.lastTime = performance.now();
  }

  function endGame() {
    game.state = 'ended';
    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem(BEST_KEY, String(game.best));
    }
    updateHUD();
    ui.finalScore.textContent = game.score;
    const stars = game.score >= 700 ? 3 : game.score >= 420 ? 2 : game.score >= 180 ? 1 : 0;
    ui.stars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    ui.resultMessage.textContent = stars === 3 ? '傳說級主廚！整間餐廳都在為你歡呼。' : stars === 2 ? '出餐節奏很穩，再快一點就能三星！' : stars === 1 ? '順利撐過晚餐尖峰，下一局會更熟練。' : '先熟悉動線，再挑戰更高分！';
    ui.end.classList.add('visible');
    ui.controls.classList.add('hidden'); ui.prompt.classList.add('hidden');
    beep(392, .16, 'triangle'); setTimeout(() => beep(330, .24, 'triangle'), 170);
  }

  function station(id) { return stations.find(s => s.id === id); }
  function center(s) { return { x: s.x + s.w / 2, y: s.y + s.h / 2 }; }

  function nearestStation(maxDist = 82) {
    let best = null; let bestD = maxDist;
    for (const s of stations) {
      if (s.type === 'counter') continue;
      const c = center(s); const d = Math.hypot(player.x - c.x, player.y - c.y);
      if (d < bestD) { best = s; bestD = d; }
    }
    return best;
  }

  function promptFor(s) {
    if (!s) return '';
    const carry = player.carry;
    if (s.type === 'crate') return carry ? `${INGREDIENTS[s.ingredient].name}箱（手上已有物品）` : `拿取 ${INGREDIENTS[s.ingredient].emoji} ${INGREDIENTS[s.ingredient].name}`;
    if (s.type === 'board') {
      if (s.item?.state === 'raw') return `長按「切」處理 ${INGREDIENTS[s.item.ingredient].name}`;
      if (!carry && s.item) return `拿起切好的 ${INGREDIENTS[s.item.ingredient].name}`;
      if (carry?.kind === 'ingredient' && carry.state === 'raw' && !s.item) return '把食材放上砧板';
      return '砧板';
    }
    if (s.type === 'pot') {
      if (s.burned || s.invalid) return '按「切」清空鍋子';
      if (carry?.kind === 'ingredient' && carry.state === 'chopped') return '放入鍋中';
      if (carry?.kind === 'plate' && !carry.dish && s.ready) return '盛湯裝盤';
      if (s.ready) return '湯煮好了，拿盤子來盛';
      if (s.ingredients.length) return `烹煮中 ${Math.round(s.cook * 100)}%`;
      return '湯鍋';
    }
    if (s.type === 'plates') return carry ? '盤子堆' : '拿一個空盤';
    if (s.type === 'serve') return carry?.kind === 'plate' && carry.dish ? '送出料理！' : '出餐口';
    if (s.type === 'trash') return carry ? '丟棄手上物品' : '垃圾桶';
    if (s.type === 'assistant') return s.item && !carry ? `拿取助手準備的 ${INGREDIENTS[s.item.ingredient].emoji}` : 'AI 助手托盤';
    return s.label;
  }

  function interact() {
    if (game.state !== 'playing') return;
    const s = nearestStation();
    if (!s) return;
    const carry = player.carry;

    if (s.type === 'crate') {
      if (!carry) {
        player.carry = { kind: 'ingredient', ingredient: s.ingredient, state: 'raw' };
        beep(660, .05, 'square');
      }
    } else if (s.type === 'board') {
      if (!carry && s.item) {
        player.carry = s.item; s.item = null; s.progress = 0; beep(600, .05, 'square');
      } else if (carry?.kind === 'ingredient' && carry.state === 'raw' && !s.item) {
        s.item = carry; player.carry = null; s.progress = 0; beep(440, .06, 'square');
      }
    } else if (s.type === 'pot') {
      if (s.burned || s.invalid) {
        showToast('這鍋不能用了，按「切」清空', 'bad');
      } else if (carry?.kind === 'ingredient' && carry.state === 'chopped' && s.ingredients.length < 3 && !s.ready) {
        s.ingredients.push(carry.ingredient); player.carry = null; beep(360 + s.ingredients.length * 90, .07, 'triangle');
        if (s.ingredients.length === 3) validatePot(s);
      } else if (carry?.kind === 'plate' && !carry.dish && s.ready) {
        carry.dish = s.recipe;
        Object.assign(s, { ingredients: [], cook: 0, ready: false, burned: false, invalid: false, readyTimer: 0 });
        showToast(`${RECIPES[carry.dish].name} 裝盤完成`, 'good'); beep(760, .09, 'sine');
      }
    } else if (s.type === 'plates') {
      if (!carry) { player.carry = { kind: 'plate', dish: null }; beep(740, .04, 'sine'); }
    } else if (s.type === 'serve') {
      if (carry?.kind === 'plate' && carry.dish) submitDish(carry.dish);
    } else if (s.type === 'trash') {
      if (carry) { player.carry = null; game.score = Math.max(0, game.score - 5); showToast('丟棄物品 -5', 'bad'); beep(160, .11, 'sawtooth'); }
    } else if (s.type === 'assistant') {
      if (!carry && s.item) { player.carry = s.item; s.item = null; beep(620, .07, 'square'); }
    }
    updateHUD();
  }

  function validatePot(s) {
    const first = s.ingredients[0];
    if (s.ingredients.every(v => v === first)) {
      s.recipe = first; s.cook = 0.001; showToast(`${RECIPES[first].name} 開始烹煮`);
    } else {
      s.invalid = true; showToast('配方錯誤！請清空鍋子', 'bad'); beep(130, .2, 'sawtooth');
    }
  }

  function clearPot() {
    const s = nearestStation();
    if (s?.type === 'pot' && (s.burned || s.invalid)) {
      Object.assign(s, { ingredients: [], cook: 0, ready: false, burned: false, invalid: false, readyTimer: 0 });
      game.score = Math.max(0, game.score - 8);
      showToast('鍋子已清空 -8', 'bad'); beep(180, .12, 'square');
    }
  }

  function submitDish(recipeKey) {
    const idx = game.orders.findIndex(o => o.recipe.key === recipeKey);
    if (idx === -1) {
      game.score = Math.max(0, game.score - 20); game.combo = 0;
      showToast('沒有這張訂單 -20', 'bad'); beep(130, .2, 'sawtooth');
      player.carry = { kind: 'plate', dish: null };
      return;
    }
    const order = game.orders[idx];
    const speedBonus = Math.round(order.time * 1.2);
    game.combo = game.comboTimer > 0 ? game.combo + 1 : 1;
    game.comboTimer = 12;
    const comboBonus = Math.max(0, (game.combo - 1) * 10);
    const points = 70 + speedBonus + comboBonus;
    game.score += points; game.served += 1;
    player.carry = null;
    game.orders.splice(idx, 1); addOrder();
    burst(station('serve').x + 20, station('serve').y + 55, '#ffd15c', 22);
    game.shake = 7;
    showToast(`完美出餐 +${points}${comboBonus ? `（連擊 ${game.combo}）` : ''}`, 'good');
    beep(740, .08, 'triangle'); setTimeout(() => beep(980, .11, 'triangle'), 80);
    updateOrders(); updateHUD();
  }

  function doDash() {
    if (player.dashCooldown > 0 || game.state !== 'playing') return;
    player.dashCooldown = 1.25; player.dashTimer = .18;
    beep(250, .05, 'square', .02);
  }

  function update(dt) {
    if (game.state !== 'playing') return;
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) { game.timeLeft = 0; endGame(); return; }

    readKeyboard();
    updatePlayer(dt);
    updateBoard(dt);
    updatePot(dt);
    updateHelper(dt);
    updateOrdersTime(dt);
    updateParticles(dt);
    updatePrompt();

    if (game.comboTimer > 0) game.comboTimer -= dt; else game.combo = 0;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 28);
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.dashTimer > 0) player.dashTimer -= dt;

    if (input.interactPressed) { interact(); input.interactPressed = false; }
    if (input.dashPressed) { doDash(); input.dashPressed = false; }
    if (input.actionHeld) clearPot();

    updateHUD();
  }

  function readKeyboard() {
    let x = 0, y = 0;
    if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) x -= 1;
    if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) x += 1;
    if (input.keys.has('ArrowUp') || input.keys.has('KeyW')) y -= 1;
    if (input.keys.has('ArrowDown') || input.keys.has('KeyS')) y += 1;
    if (x || y) { input.x = x; input.y = y; }
  }

  function updatePlayer(dt) {
    let dx = input.x, dy = input.y;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    if (mag > .05) { player.facingX = dx; player.facingY = dy; }
    const dashMul = player.dashTimer > 0 ? 2.5 : 1;
    const vx = dx * player.speed * dashMul * dt;
    const vy = dy * player.speed * dashMul * dt;
    moveWithCollision(vx, 0);
    moveWithCollision(0, vy);
    player.step += Math.hypot(vx, vy) * .06;
  }

  function moveWithCollision(dx, dy) {
    player.x += dx; player.y += dy;
    player.x = Math.max(player.r + 8, Math.min(W - player.r - 8, player.x));
    player.y = Math.max(player.r + 8, Math.min(H - player.r - 8, player.y));
    for (const c of colliders) {
      const nx = Math.max(c.x, Math.min(player.x, c.x + c.w));
      const ny = Math.max(c.y, Math.min(player.y, c.y + c.h));
      const ddx = player.x - nx, ddy = player.y - ny;
      const dist2 = ddx * ddx + ddy * ddy;
      if (dist2 < player.r * player.r) {
        const dist = Math.sqrt(dist2) || .001;
        const overlap = player.r - dist;
        player.x += ddx / dist * overlap;
        player.y += ddy / dist * overlap;
      }
    }
  }

  function updateBoard(dt) {
    const b = station('board');
    if (!b.item || b.item.state !== 'raw') return;
    const close = nearestStation(86)?.id === 'board';
    if (close && input.actionHeld) {
      b.progress += dt / 2.2;
      if (Math.random() < dt * 13) burst(b.x + b.w / 2, b.y + 28, '#f7e4a6', 1);
      if (b.progress >= 1) {
        b.progress = 1; b.item.state = 'chopped';
        showToast(`${INGREDIENTS[b.item.ingredient].name} 切好了`, 'good');
        beep(540, .05, 'square'); setTimeout(() => beep(700, .07, 'square'), 55);
      }
    }
  }

  function updatePot(dt) {
    const p = station('pot');
    p.bubble += dt;
    if (p.cook > 0 && !p.ready && !p.burned && !p.invalid) {
      p.cook += dt / 6.2;
      if (p.cook >= 1) {
        p.cook = 1; p.ready = true; p.readyTimer = 0;
        showToast(`${RECIPES[p.recipe].name} 煮好了！`, 'good');
        beep(820, .08, 'sine'); setTimeout(() => beep(900, .08, 'sine'), 120);
      }
    } else if (p.ready) {
      p.readyTimer += dt;
      if (p.readyTimer >= 9) {
        p.ready = false; p.burned = true; game.combo = 0;
        showToast('糟糕，湯燒焦了！', 'bad'); beep(115, .35, 'sawtooth');
      }
    }
  }

  function updateHelper(dt) {
    if (!helper.enabled || game.orders.length === 0) return;
    helper.bob += dt * 5;
    helper.timer -= dt;
    const tray = station('assistant');
    const targetRecipe = game.orders[0].recipe;

    if (helper.phase === 'idle' && helper.timer <= 0 && !tray.item) {
      const crate = station(`${targetRecipe.ingredient}-crate`);
      const c = center(crate);
      helper.targetX = c.x + 70; helper.targetY = c.y;
      helper.phase = 'fetch'; helper.timer = 0;
    }

    const dx = helper.targetX - helper.x, dy = helper.targetY - helper.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) {
      const speed = 100;
      helper.x += dx / d * Math.min(d, speed * dt);
      helper.y += dy / d * Math.min(d, speed * dt);
    } else {
      if (helper.phase === 'fetch') {
        helper.carry = { kind: 'ingredient', ingredient: targetRecipe.ingredient, state: 'raw' };
        helper.targetX = 230; helper.targetY = 510; helper.phase = 'chop'; helper.timer = 2.8;
      } else if (helper.phase === 'chop') {
        if (helper.timer <= 0) {
          helper.carry.state = 'chopped'; const c = center(tray);
          helper.targetX = c.x - 55; helper.targetY = c.y; helper.phase = 'deliver';
        }
      } else if (helper.phase === 'deliver') {
        if (!tray.item) tray.item = helper.carry;
        helper.carry = null; helper.targetX = 220; helper.targetY = 475; helper.phase = 'return';
        showToast('AI 助手送來一份切好的食材', 'good'); beep(620, .06, 'triangle');
      } else if (helper.phase === 'return') {
        helper.phase = 'idle'; helper.timer = 8.5;
      }
    }
  }

  function updateOrdersTime(dt) {
    let changed = false;
    for (let i = game.orders.length - 1; i >= 0; i--) {
      game.orders[i].time -= dt;
      if (game.orders[i].time <= 0) {
        game.orders.splice(i, 1); addOrder(); game.score = Math.max(0, game.score - 25); game.missed += 1; game.combo = 0;
        showToast('訂單逾時 -25', 'bad'); beep(145, .18, 'sawtooth'); changed = true;
      }
    }
    if (changed || Math.floor(game.timeLeft * 4) % 2 === 0) updateOrders();
  }

  function burst(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2; const speed = 25 + Math.random() * 105;
      game.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 20, life: .45 + Math.random() * .45, max: .9, color, size: 2 + Math.random() * 5 });
    }
  }

  function updateParticles(dt) {
    for (const p of game.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
    game.particles = game.particles.filter(p => p.life > 0);
  }

  function updateHUD() {
    ui.score.textContent = game.score;
    ui.best.textContent = Math.max(game.best, game.score);
    const sec = Math.ceil(game.timeLeft); const m = Math.floor(sec / 60); const s = sec % 60;
    ui.time.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateOrders() {
    ui.orders.innerHTML = game.orders.map(o => {
      const pct = Math.max(0, o.time / o.maxTime * 100);
      const color = pct < 30 ? '#e44f44' : pct < 55 ? '#e6aa36' : '#62c987';
      return `<div class="order-card"><div class="order-title">${o.recipe.name}</div><div class="order-ingredients">${o.recipe.emoji}</div><span class="order-time">${Math.ceil(o.time)}s</span><div class="order-bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
    }).join('');
  }

  function updatePrompt() {
    const s = nearestStation();
    const text = promptFor(s);
    ui.prompt.textContent = text;
    ui.prompt.style.opacity = text ? '1' : '0';
  }

  function draw() {
    const shakeX = game.shake > 0 ? (Math.random() - .5) * game.shake : 0;
    const shakeY = game.shake > 0 ? (Math.random() - .5) * game.shake : 0;
    ctx.save(); ctx.translate(shakeX, shakeY);
    drawBackground();
    drawStations();
    drawHelper();
    drawPlayer();
    drawParticles();
    ctx.restore();
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#34425e'); grad.addColorStop(1, '#26334d');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#41506d'; ctx.fillRect(18, 20, W - 36, H - 40);
    ctx.fillStyle = '#596784'; ctx.fillRect(28, 30, W - 56, H - 60);

    const tile = 48;
    for (let y = 34; y < H - 30; y += tile) {
      for (let x = 32; x < W - 28; x += tile) {
        ctx.fillStyle = ((x / tile + y / tile) & 1) ? '#e7d9ba' : '#f3e6c9';
        roundRect(x, y, tile - 2, tile - 2, 5, true);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(395, 44, 170, 548);
    ctx.fillStyle = '#20304c'; roundRect(865, 190, 67, 245, 20, true);
    ctx.fillStyle = 'rgba(255,255,255,.17)'; ctx.fillRect(881, 210, 10, 205);
  }

  function drawStations() {
    for (const s of stations) {
      if (s.type === 'crate') drawCrate(s);
      else if (s.type === 'board') drawBoard(s);
      else if (s.type === 'pot') drawPot(s);
      else if (s.type === 'plates') drawPlates(s);
      else if (s.type === 'serve') drawServe(s);
      else if (s.type === 'trash') drawTrash(s);
      else if (s.type === 'assistant') drawAssistantTray(s);
      else drawCounter(s);
    }
    const near = nearestStation();
    if (near) {
      ctx.strokeStyle = 'rgba(255,223,102,.92)'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]);
      roundRect(near.x - 4, near.y - 4, near.w + 8, near.h + 8, 15, false, true); ctx.setLineDash([]);
    }
  }

  function baseCounter(s, top = '#f7f0d7') {
    ctx.fillStyle = 'rgba(67,41,25,.25)'; roundRect(s.x + 3, s.y + 10, s.w, s.h, 13, true);
    ctx.fillStyle = '#80593e'; roundRect(s.x, s.y + 8, s.w, s.h - 4, 13, true);
    ctx.fillStyle = top; roundRect(s.x, s.y, s.w, s.h - 14, 13, true);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; roundRect(s.x + 7, s.y + 6, s.w - 14, 8, 5, true);
  }

  function drawCrate(s) {
    ctx.fillStyle = 'rgba(67,41,25,.25)'; roundRect(s.x + 3, s.y + 8, s.w, s.h, 10, true);
    ctx.fillStyle = '#9e653c'; roundRect(s.x, s.y, s.w, s.h, 10, true);
    ctx.strokeStyle = '#754528'; ctx.lineWidth = 5; roundRect(s.x + 5, s.y + 5, s.w - 10, s.h - 10, 7, false, true);
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(s.x + 12, s.y + 17); ctx.lineTo(s.x + s.w - 12, s.y + s.h - 17); ctx.moveTo(s.x + s.w - 12, s.y + 17); ctx.lineTo(s.x + 12, s.y + s.h - 17); ctx.stroke();
    drawEmoji(INGREDIENTS[s.ingredient].emoji, s.x + s.w / 2, s.y + s.h / 2 + 2, 34);
  }

  function drawBoard(s) {
    baseCounter(s, '#f4e7c2');
    ctx.fillStyle = '#c88a48'; roundRect(s.x + 17, s.y + 12, s.w - 34, 35, 8, true);
    ctx.strokeStyle = '#966231'; ctx.lineWidth = 3; roundRect(s.x + 17, s.y + 12, s.w - 34, 35, 8, false, true);
    if (s.item) {
      drawEmoji(INGREDIENTS[s.item.ingredient].emoji, s.x + s.w / 2, s.y + 28, 28);
      if (s.item.state === 'raw') drawProgressBar(s.x + 18, s.y + 53, s.w - 36, 8, s.progress, '#4fc18a');
      if (s.item.state === 'chopped') {
        ctx.fillStyle = '#42b77f'; ctx.beginPath(); ctx.arc(s.x + s.w - 18, s.y + 17, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✓', s.x + s.w - 18, s.y + 22);
      }
    }
  }

  function drawPot(s) {
    baseCounter(s, '#dfe6ec');
    ctx.fillStyle = '#4b5a69'; roundRect(s.x + 18, s.y + 14, s.w - 36, 38, 12, true);
    ctx.fillStyle = s.burned ? '#2d2423' : s.invalid ? '#777' : s.ready ? RECIPES[s.recipe].color : '#8796a5';
    ctx.beginPath(); ctx.ellipse(s.x + s.w / 2, s.y + 27, 28, 16, 0, 0, Math.PI * 2); ctx.fill();
    if (s.ingredients.length) {
      s.ingredients.forEach((ing, i) => drawEmoji(INGREDIENTS[ing].emoji, s.x + 40 + i * 14, s.y + 26 + Math.sin(s.bubble * 4 + i) * 2, 16));
    }
    if (s.cook > 0 && !s.ready) drawProgressBar(s.x + 15, s.y + 59, s.w - 30, 8, s.cook, '#f49e45');
    if (s.ready) {
      for (let i = 0; i < 3; i++) {
        const bx = s.x + 35 + i * 18; const by = s.y + 20 - ((s.bubble * 22 + i * 8) % 22);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(bx, by, 3 + i, 0, Math.PI * 2); ctx.fill();
      }
      const left = Math.max(0, 9 - s.readyTimer); drawProgressBar(s.x + 15, s.y + 59, s.w - 30, 8, left / 9, left < 3 ? '#e65443' : '#52c584');
    }
    if (s.burned) drawEmoji('🔥', s.x + s.w / 2, s.y + 12, 26);
    if (s.invalid) drawEmoji('⚠️', s.x + s.w / 2, s.y + 10, 25);
  }

  function drawPlates(s) {
    baseCounter(s, '#ecf3f6');
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#aab8c1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.x + s.w / 2, s.y + 38 - i * 7, 30, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  function drawServe(s) {
    ctx.fillStyle = '#f4b643'; roundRect(s.x, s.y, s.w, s.h, 16, true);
    ctx.fillStyle = '#ffe9a7'; roundRect(s.x + 8, s.y + 8, s.w - 16, s.h - 16, 12, true);
    ctx.fillStyle = '#e65d38'; roundRect(s.x + 18, s.y + 52, s.w - 36, 36, 8, true);
    drawEmoji('🔔', s.x + s.w / 2, s.y + 34, 30);
    ctx.fillStyle = '#fff'; ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('出餐', s.x + s.w / 2, s.y + 76);
  }

  function drawTrash(s) {
    ctx.fillStyle = '#566875'; roundRect(s.x + 8, s.y + 10, s.w - 16, s.h - 7, 10, true);
    ctx.fillStyle = '#344754'; roundRect(s.x, s.y + 5, s.w, 16, 8, true);
    ctx.fillStyle = '#91a5ad'; roundRect(s.x + 25, s.y, s.w - 50, 8, 4, true);
    drawEmoji('🗑️', s.x + s.w / 2, s.y + 48, 30);
  }

  function drawAssistantTray(s) {
    baseCounter(s, '#bde7d0');
    ctx.fillStyle = '#4d9475'; roundRect(s.x + 12, s.y + 12, s.w - 24, 38, 9, true);
    if (s.item) drawEmoji(INGREDIENTS[s.item.ingredient].emoji, s.x + s.w / 2, s.y + 30, 31);
    else { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('AI 托盤', s.x + s.w / 2, s.y + 35); }
  }

  function drawCounter(s) {
    baseCounter(s, '#f0dbc0');
    ctx.fillStyle = '#a26f4a';
    for (let x = s.x + 12; x < s.x + s.w - 8; x += 22) roundRect(x, s.y + 24, 12, 28, 4, true);
  }

  function drawPlayer() {
    const bounce = Math.sin(player.step) * 2;
    ctx.save(); ctx.translate(player.x, player.y + bounce);
    ctx.fillStyle = 'rgba(31,35,45,.24)'; ctx.beginPath(); ctx.ellipse(0, 19, 25, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4c79a'; ctx.beginPath(); ctx.arc(0, -8, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef6a3a'; roundRect(-19, 5, 38, 31, 14, true);
    ctx.fillStyle = '#fff'; roundRect(-12, 5, 24, 26, 8, true);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -23, 14, Math.PI, Math.PI * 2); ctx.fill();
    roundRect(-15, -28, 30, 9, 5, true);
    ctx.fillStyle = '#33415c'; ctx.beginPath(); ctx.arc(-6 + player.facingX * 2, -9 + player.facingY * 1, 2, 0, Math.PI * 2); ctx.arc(6 + player.facingX * 2, -9 + player.facingY * 1, 2, 0, Math.PI * 2); ctx.fill();
    if (player.carry) drawCarry(player.carry, 0, -47);
    ctx.restore();
  }

  function drawHelper() {
    const bob = Math.sin(helper.bob) * 2;
    ctx.save(); ctx.translate(helper.x, helper.y + bob);
    ctx.fillStyle = 'rgba(31,35,45,.2)'; ctx.beginPath(); ctx.ellipse(0, 17, 21, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#80c7a8'; roundRect(-17, -5, 34, 34, 13, true);
    ctx.fillStyle = '#dff7ec'; ctx.beginPath(); ctx.arc(0, -14, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#33415c'; ctx.beginPath(); ctx.arc(-5, -14, 2, 0, Math.PI * 2); ctx.arc(5, -14, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#33415c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -10, 5, .2, Math.PI - .2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '900 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('AI', 0, 17);
    if (helper.carry) drawCarry(helper.carry, 0, -39);
    if (helper.phase === 'chop') {
      const pct = 1 - Math.max(0, helper.timer) / 2.8; drawProgressBar(-24, -47, 48, 6, pct, '#54c48b');
    }
    ctx.restore();
  }

  function drawCarry(item, x, y) {
    if (item.kind === 'ingredient') {
      ctx.fillStyle = '#fff7de'; ctx.beginPath(); ctx.ellipse(x, y + 3, 22, 11, 0, 0, Math.PI * 2); ctx.fill();
      drawEmoji(INGREDIENTS[item.ingredient].emoji, x, y - 2, item.state === 'chopped' ? 23 : 27);
      if (item.state === 'chopped') {
        ctx.fillStyle = '#4cb783'; ctx.beginPath(); ctx.arc(x + 18, y - 8, 7, 0, Math.PI * 2); ctx.fill();
      }
    } else if (item.kind === 'plate') {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#aebbc3'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 24, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (item.dish) {
        ctx.fillStyle = RECIPES[item.dish].color; ctx.beginPath(); ctx.ellipse(x, y - 2, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
        drawEmoji(INGREDIENTS[item.dish].emoji, x, y - 8, 16);
      }
    }
  }

  function drawParticles() {
    for (const p of game.particles) {
      ctx.globalAlpha = Math.min(1, p.life / .25); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEmoji(emoji, x, y, size) {
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emoji, x, y);
  }

  function drawProgressBar(x, y, w, h, pct, color) {
    ctx.fillStyle = 'rgba(36,39,49,.25)'; roundRect(x, y, w, h, h / 2, true);
    ctx.fillStyle = color; roundRect(x, y, Math.max(0, w * Math.min(1, pct)), h, h / 2, true);
  }

  function roundRect(x, y, w, h, r, fill = false, stroke = false) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
    if (fill) ctx.fill(); if (stroke) ctx.stroke();
  }

  function loop(now) {
    const dt = Math.min(.034, (now - game.lastTime) / 1000 || 0);
    game.lastTime = now;
    update(dt); draw(); requestAnimationFrame(loop);
  }

  function setActionHeld(value) {
    input.actionHeld = value;
    document.getElementById('action-btn').classList.toggle('pressed', value);
  }

  window.addEventListener('keydown', e => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    input.keys.add(e.code);
    if (e.code === 'KeyE' && !e.repeat) input.interactPressed = true;
    if (e.code === 'Space') setActionHeld(true);
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) input.dashPressed = true;
    if (e.code === 'Escape') game.state === 'playing' ? pauseGame() : game.state === 'paused' && resumeGame();
  }, { passive: false });
  window.addEventListener('keyup', e => {
    input.keys.delete(e.code);
    if (e.code === 'Space') setActionHeld(false);
    if (![...input.keys].some(k => ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(k))) { input.x = 0; input.y = 0; }
  });
  window.addEventListener('blur', () => { input.keys.clear(); input.x = 0; input.y = 0; setActionHeld(false); if (game.state === 'playing') pauseGame(); });

  const joyZone = document.getElementById('joystick-zone');
  const joyBase = document.getElementById('joystick-base');
  const joyKnob = document.getElementById('joystick-knob');
  function updateJoy(e) {
    const r = joyBase.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const max = r.width * .34; const d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.x = dx / max; input.y = dy / max;
  }
  joyZone.addEventListener('pointerdown', e => { input.joyPointer = e.pointerId; joyZone.setPointerCapture(e.pointerId); updateJoy(e); });
  joyZone.addEventListener('pointermove', e => { if (e.pointerId === input.joyPointer) updateJoy(e); });
  function endJoy(e) { if (e.pointerId !== input.joyPointer) return; input.joyPointer = null; input.x = 0; input.y = 0; joyKnob.style.transform = 'translate(0,0)'; }
  joyZone.addEventListener('pointerup', endJoy); joyZone.addEventListener('pointercancel', endJoy);

  document.getElementById('interact-btn').addEventListener('pointerdown', e => { e.preventDefault(); input.interactPressed = true; });
  document.getElementById('action-btn').addEventListener('pointerdown', e => { e.preventDefault(); setActionHeld(true); e.currentTarget.setPointerCapture(e.pointerId); });
  document.getElementById('action-btn').addEventListener('pointerup', () => setActionHeld(false));
  document.getElementById('action-btn').addEventListener('pointercancel', () => setActionHeld(false));
  document.getElementById('dash-btn').addEventListener('pointerdown', e => { e.preventDefault(); input.dashPressed = true; });

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('how-btn').addEventListener('click', () => ui.tutorial.classList.add('visible'));
  document.getElementById('tutorial-close').addEventListener('click', () => ui.tutorial.classList.remove('visible'));
  document.getElementById('pause-btn').addEventListener('click', pauseGame);
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('home-btn').addEventListener('click', goHome);
  document.getElementById('play-again-btn').addEventListener('click', startGame);
  document.getElementById('end-home-btn').addEventListener('click', goHome);

  document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') pauseGame(); });
  document.addEventListener('contextmenu', e => e.preventDefault());

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }

  ui.best.textContent = game.best;
  updateHUD(); draw(); requestAnimationFrame(loop);
})();
