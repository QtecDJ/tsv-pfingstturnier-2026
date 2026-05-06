(() => {
  const canvas = document.getElementById("goal-game");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  const scoreNode = document.querySelector("[data-score]");
  const goalsNode = document.querySelector("[data-goals]");
  const shotsNode = document.querySelector("[data-shots]");
  const messageNode = document.querySelector("[data-message]");
  const powerNode = document.querySelector("[data-power]");
  const restartButton = document.querySelector("[data-restart]");
  const playerNameNode = document.querySelector("[data-player-name]");
  const playerDisplayNode = document.querySelector("[data-player-display]");
  const startPanel = document.querySelector("[data-start-panel]");
  const startButton = document.querySelector("[data-start-game]");
  const modeStatusNode = document.querySelector("[data-mode-status]");
  const roundLabelNode = document.querySelector("[data-round-label]");
  const opponentNode = document.querySelector("[data-opponent]");
  const menuButton = document.querySelector(".menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  function gameImage(src) {
    const image = new Image();
    image.src = src;
    return image;
  }

  const sponsorWall = gameImage("../assets/site/sponsoren.jpg");
  const keeperSprite = gameImage("assets/game/keeper-tsv.png");
  const keeperFrames = {
    idleA: gameImage("assets/game/keeper-idle-1.png"),
    idleB: gameImage("assets/game/keeper-idle-2.png"),
    readyLeft: gameImage("assets/game/keeper-ready-left.png"),
    readyRight: gameImage("assets/game/keeper-ready-right.png"),
    diveLeft: gameImage("assets/game/keeper-dive-left.png"),
    diveRight: gameImage("assets/game/keeper-dive-right.png"),
  };
  const fieldImage = gameImage("assets/game/field-tsv-ai.png");
  const ballImage = gameImage("assets/game/football-ai.png");
  const targetImage = gameImage("assets/game/target-ai.png");

  const WIDTH = 1120;
  const HEIGHT = 720;
  const remoteLeaderboard = {
    namespace: "tsv-plattenhardt-pfingstturnier-2026-leaderboard",
    baseUrl: "https://mantledb.sh/v2/tsv-plattenhardt-pfingstturnier-2026-leaderboard",
  };
  let view = { scale: 1, offsetX: 0, offsetY: 0, cssWidth: 1, cssHeight: 1 };

  const state = {
    score: 0,
    goals: 0,
    combo: 0,
    shotsLeft: 7,
    message: "Ball antippen, ziehen und mit Effet ins Eck schicken.",
    aiming: false,
    shotActive: false,
    resultTimer: 0,
    time: 0,
    flash: 0,
    targetHit: null,
    dragStart: { x: 560, y: 650 },
    pointer: { x: 560, y: 650 },
    start: { x: 560, y: 650 },
    ball: {
      x: 560,
      y: 650,
      r: 21,
      vx: 0,
      vy: 0,
      spin: 0,
      age: 0,
      trail: [],
    },
    keeper: {
      x: 560,
      y: 314,
      baseX: 560,
      targetX: 560,
      dive: 0,
      reach: 0,
      saveFlash: 0,
    },
    particles: [],
    matchSaved: false,
    round: 0,
    tournamentOver: false,
    opponentScore: 0,
    started: false,
  };

  const tournamentRounds = ["Viertelfinale", "Halbfinale", "Finale"];
  const opponentPool = [
    "SV Horn",
    "KAS Eupen",
    "Eintracht Frankfurt",
    "Hannover 96",
    "FC Basel",
    "Viktoria Pilsen",
    "Hessen Kassel",
    "Kaiserslautern",
    "SSV Reutlingen",
  ];

  const goal = { x: 230, y: 76, w: 660, h: 242 };
  const targets = [
    { id: "left-top", x: 292, y: 126, r: 42, points: 190, label: "Winkel" },
    { id: "right-top", x: 828, y: 126, r: 42, points: 190, label: "Winkel" },
    { id: "left-low", x: 306, y: 272, r: 35, points: 135, label: "Flach" },
    { id: "right-low", x: 814, y: 272, r: 35, points: 135, label: "Flach" },
    { id: "center", x: 560, y: 172, r: 38, points: 90, label: "Mut" },
  ];

  const sponsorLabels = [
    "TSV Partner",
    "Autohaus Briem",
    "Sportgaststaette Weilerhau",
    "Filderstadt",
    "Pfingstturnier 2026",
  ];

  function loadLeaderboard() {
    try {
      return JSON.parse(localStorage.getItem("tsv-goal-leaderboard") || "[]");
    } catch {
      return [];
    }
  }

  function saveLeaderboard(entries) {
    localStorage.setItem("tsv-goal-leaderboard", JSON.stringify(entries.slice(0, 12)));
  }

  function renderLeaderboard() {
    return loadLeaderboard().sort((a, b) => b.score - a.score).slice(0, 8);
  }

  function currentPlayerName() {
    const typed = playerNameNode?.value?.trim() || "TSV Spieler";
    return typed;
  }

  function restorePlayerName() {
    try {
      const savedName = localStorage.getItem("tsv-goal-player-name");
      if (savedName && playerNameNode) playerNameNode.value = savedName.slice(0, 18);
    } catch {
      // Ohne localStorage bleibt der Standardname aktiv.
    }
  }

  function rememberPlayerName() {
    try {
      localStorage.setItem("tsv-goal-player-name", currentPlayerName());
    } catch {
      // Private Browsermodi koennen localStorage blockieren.
    }
  }

  function currentPlayerSlug() {
    return currentPlayerName()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28) || "tsv-spieler";
  }

  function updatePlayerDisplay() {
    if (playerDisplayNode) playerDisplayNode.textContent = currentPlayerName();
  }

  function currentOpponent() {
    const seed = currentPlayerName().split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return opponentPool[(seed + state.round * 3) % opponentPool.length];
  }

  function opponentScoreForRound() {
    const base = [430, 560, 690][state.round] || 520;
    const nameSeed = currentOpponent().split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return base + ((nameSeed + state.round * 71) % 130);
  }

  function makeResultEntry() {
    return {
      id: `${Date.now()}-${currentPlayerSlug()}-${Math.random().toString(36).slice(2, 8)}`,
      name: currentPlayerName(),
      score: state.score,
      goals: state.goals,
      mode: tournamentRounds[state.round] || "Turnier",
      date: new Date().toISOString(),
    };
  }

  async function submitRemoteScore(entry) {
    try {
      await fetch(`${remoteLeaderboard.baseUrl}/scores/${entry.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(entry),
      });
    } catch {
      // Das Spiel bleibt lokal spielbar, falls der kostenlose Dienst gerade nicht antwortet.
    }
  }

  function storeCurrentResult() {
    if (state.matchSaved) return;

    const entry = makeResultEntry();
    const entries = loadLeaderboard();
    entries.push(entry);
    saveLeaderboard(entries.sort((a, b) => b.score - a.score));
    submitRemoteScore(entry);
    state.matchSaved = true;
    renderLeaderboard();
  }

  function updateModeStatus() {
    if (!modeStatusNode) return;
    if (roundLabelNode) roundLabelNode.textContent = tournamentRounds[state.round] || "Turnier beendet";
    if (opponentNode) opponentNode.textContent = currentOpponent();
    const target = opponentScoreForRound();
    modeStatusNode.textContent = `Gegner: ${currentOpponent()} wartet mit ca. ${target} Punkten.`;
  }

  function setupMenu() {
    if (!menuButton || !mobileMenu) return;

    function setMenuState(isOpen) {
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "Menue schliessen" : "Menue oeffnen");
      mobileMenu.hidden = !isOpen;
    }

    menuButton.addEventListener("click", () => {
      setMenuState(menuButton.getAttribute("aria-expanded") !== "true");
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenuState(false));
    });
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    view.cssWidth = rect.width;
    view.cssHeight = rect.height;
    view.scale = Math.max(rect.width / WIDTH, rect.height / HEIGHT);
    view.offsetX = (rect.width - WIDTH * view.scale) / 2;
    view.offsetY = (rect.height - HEIGHT * view.scale) / 2;
    ctx.setTransform(ratio * view.scale, 0, 0, ratio * view.scale, ratio * view.offsetX, ratio * view.offsetY);
  }

  function writeHud() {
    updatePlayerDisplay();
    if (scoreNode) scoreNode.textContent = state.score;
    if (goalsNode) goalsNode.textContent = state.goals;
    if (shotsNode) shotsNode.textContent = state.shotsLeft;
    if (messageNode) messageNode.textContent = state.message;
  }

  function resetBall() {
    state.start = { x: 560, y: 650 };
    state.dragStart = { ...state.start };
    state.ball.x = state.start.x;
    state.ball.y = state.start.y;
    state.ball.r = 21;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.spin = 0;
    state.ball.age = 0;
    state.ball.trail = [];
    state.pointer = { ...state.start };
    state.aiming = false;
    state.shotActive = false;
    state.resultTimer = 0;
    state.targetHit = null;
    if (powerNode) powerNode.style.width = "0%";
  }

  function restartGame() {
    state.score = 0;
    state.goals = 0;
    state.combo = 0;
    state.shotsLeft = 7;
    state.matchSaved = false;
    state.tournamentOver = false;
    state.started = true;
    state.message = "Ball antippen, ziehen und mit Effet ins Eck schicken.";
    state.flash = 0;
    state.particles = [];
    resetBall();
    writeHud();
    updateModeStatus();
  }

  function finishMatch() {
    storeCurrentResult();
    const opponent = currentOpponent();
    const opponentScore = opponentScoreForRound();
    state.opponentScore = opponentScore;

    if (state.score > opponentScore) {
      if (state.round >= tournamentRounds.length - 1) {
        state.message = `Turniersieg! ${state.score}:${opponentScore} gegen ${opponent}.`;
        state.tournamentOver = true;
      } else {
        state.message = `Weiter! ${state.score}:${opponentScore} gegen ${opponent}. Naechste Runde startet.`;
        state.round += 1;
        window.setTimeout(() => restartGame(), 1200);
      }
    } else {
      state.message = `Ausgeschieden: ${state.score}:${opponentScore} gegen ${opponent}. Neues Turnier starten.`;
      state.round = 0;
      state.tournamentOver = true;
    }
    updateModeStatus();
    writeHud();
  }

  function getPointer(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - view.offsetX) / view.scale,
      y: (event.clientY - rect.top - view.offsetY) / view.scale,
    };
  }

  function ballGrabDistance(point) {
    return Math.hypot(point.x - state.ball.x, point.y - state.ball.y);
  }

  function aimVector() {
    const moveX = state.pointer.x - state.dragStart.x;
    const moveY = state.pointer.y - state.dragStart.y;
    const directShot = moveY < -10;
    const pullX = directShot ? moveX : state.dragStart.x - state.pointer.x;
    const pullY = directShot ? moveY : -Math.max(0, state.pointer.y - state.dragStart.y);
    const dx = pullX * 0.95;
    const dy = pullY * 1.15;
    const length = Math.hypot(moveX, moveY);
    return {
      dx,
      dy,
      length,
      power: Math.min(1, length / 260),
    };
  }

  function startAim(event) {
    if (!state.started || state.shotActive || state.resultTimer || state.shotsLeft <= 0 || state.tournamentOver) return;
    event.preventDefault();

    const point = getPointer(event);
    if (point.x < 70 || point.x > WIDTH - 70 || point.y < 360 || point.y > HEIGHT - 12) return;

    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Manche Touch-Browser und Testumgebungen liefern Pointer anders aus.
    }
    state.aiming = true;
    state.start = {
      x: Math.max(180, Math.min(940, point.x)),
      y: Math.max(555, Math.min(670, point.y)),
    };
    state.dragStart = { ...state.start };
    state.ball.x = state.start.x;
    state.ball.y = state.start.y;
    state.pointer = { ...point };
    state.message = "Ziehen, Ziel anpeilen und loslassen.";
    writeHud();
  }

  function moveAim(event) {
    if (!state.aiming) return;
    event.preventDefault();
    state.pointer = getPointer(event);

    const aim = aimVector();
    if (powerNode) powerNode.style.width = `${Math.round(aim.power * 100)}%`;
  }

  function releaseShot(event) {
    if (!state.aiming || state.shotsLeft <= 0) return;
    event.preventDefault();

    state.pointer = getPointer(event);
    const aim = aimVector();
    const power = Math.max(0.22, aim.power);
    const sidePull = (state.dragStart.x - state.pointer.x) / 190;
    const predictedX = state.start.x + aim.dx * 1.45 + sidePull * 135;

    if (aim.length < 38) {
      state.aiming = false;
      state.message = "Etwas weiter ziehen fuer einen echten Schuss.";
      if (powerNode) powerNode.style.width = "0%";
      writeHud();
      resetBall();
      return;
    }

    state.ball.vx = aim.dx * 0.1;
    state.ball.vy = aim.dy * 0.11 - 11.5 * power;
    state.ball.spin = Math.max(-1.4, Math.min(1.4, sidePull)) * power;
    state.ball.r = 21;
    state.ball.age = 0;
    state.ball.trail = [];
    state.keeper.targetX = Math.max(goal.x + 110, Math.min(goal.x + goal.w - 110, predictedX));
    state.keeper.dive = Math.sign(state.keeper.targetX - state.keeper.x);
    state.keeper.saveFlash = 16;
    state.shotActive = true;
    state.aiming = false;
    state.shotsLeft -= 1;
    state.message = "Schuss mit Effet!";
    if (powerNode) powerNode.style.width = "0%";
    writeHud();
  }

  function keeperRect() {
    const reach = Math.abs(state.keeper.reach);
    return {
      x: state.keeper.x - 58 - reach * 62,
      y: state.keeper.y - 150,
      w: 116 + reach * 124,
      h: 154,
    };
  }

  function circleHitsRect(circle, rect) {
    const nx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    return Math.hypot(circle.x - nx, circle.y - ny) <= circle.r;
  }

  function targetAtBall() {
    return targets.find((target) => Math.hypot(state.ball.x - target.x, state.ball.y - target.y) < target.r + state.ball.r);
  }

  function addBurst(x, y, color, amount = 22) {
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 34 + Math.random() * 20,
        color,
      });
    }
  }

  function finishShot(kind) {
    state.shotActive = false;
    state.resultTimer = 48;

    if (kind === "goal") {
      const target = targetAtBall();
      const spinBonus = Math.round(Math.abs(state.ball.spin) * 28);
      const targetBonus = target ? target.points : 100;
      const comboBonus = state.combo * 25;
      const gained = targetBonus + spinBonus + comboBonus;

      state.combo += 1;
      state.goals += 1;
      state.score += gained;
      state.targetHit = target?.id || "goal";
      state.flash = 18;
      state.message = target
        ? `${target.label} getroffen: +${gained} Punkte.`
        : `Tor fuer den TSV: +${gained} Punkte.`;
      addBurst(state.ball.x, state.ball.y, "#ffffff", 28);
      addBurst(state.ball.x, state.ball.y, "#b8121b", 18);
    } else if (kind === "save") {
      state.combo = 0;
      state.message = "Keeper fliegt hin. Gehalten.";
      addBurst(state.ball.x, state.ball.y, "#213a8f", 18);
    } else {
      state.combo = 0;
      state.message = "Vorbei. Mehr Winkel, weniger Gewalt.";
    }

    if (state.shotsLeft <= 0 && kind !== "goal") {
      state.message = `Abpfiff: ${state.score} Punkte, ${state.goals} Treffer.`;
    }

    writeHud();
  }

  function updateParticles() {
    state.particles = state.particles.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.08;
      particle.life -= 1;
      return particle.life > 0;
    });
  }

  function updateGame() {
    state.time += 1;
    state.flash = Math.max(0, state.flash - 1);
    state.keeper.saveFlash = Math.max(0, state.keeper.saveFlash - 1);
    updateParticles();

    const idleSway = Math.sin(state.time * 0.035) * 115;
    const targetX = state.shotActive ? state.keeper.targetX : state.keeper.baseX + idleSway;
    state.keeper.x += (targetX - state.keeper.x) * (state.shotActive ? 0.055 : 0.035);
    state.keeper.reach += ((state.shotActive ? state.keeper.dive : 0) - state.keeper.reach) * 0.08;

    if (state.shotActive) {
      const ball = state.ball;
      ball.trail.unshift({ x: ball.x, y: ball.y, r: ball.r });
      ball.trail = ball.trail.slice(0, 12);
      ball.age += 1;
      ball.vx += ball.spin * 0.18;
      ball.vy *= 0.986;
      ball.vx *= 0.986;
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.r = Math.max(8.5, 21 - ball.age * 0.22);

      const inGoal = ball.x > goal.x + 24 && ball.x < goal.x + goal.w - 24 && ball.y > goal.y + 22 && ball.y < goal.y + goal.h - 20;
      const blocked = circleHitsRect(ball, keeperRect());
      const out = ball.x < 30 || ball.x > WIDTH - 30 || ball.y < 32 || ball.y > HEIGHT + 40;

      if (blocked) finishShot("save");
      else if (inGoal && ball.y < goal.y + goal.h * 0.93) finishShot("goal");
      else if (out || ball.age > 100) finishShot("miss");
    } else if (state.resultTimer > 0) {
      state.resultTimer -= 1;
      if (state.resultTimer === 0) {
        if (state.shotsLeft <= 0) {
          state.message = `Abpfiff: ${state.score} Punkte, ${state.goals} Treffer.`;
          writeHud();
          finishMatch();
        } else {
          resetBall();
        }
      }
    }
  }

  function roundedRect(x, y, w, h, r) {
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

  function drawSponsorBoard(x, y, w, h, index) {
    ctx.save();
    roundedRect(x, y, w, h, 5);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, w, h);

    if (sponsorWall.complete && sponsorWall.naturalWidth) {
      const slices = 5;
      const sourceW = sponsorWall.naturalWidth / slices;
      const sourceX = ((Math.floor(state.time / 110) + index) % slices) * sourceW;
      ctx.drawImage(sponsorWall, sourceX, 0, sourceW, sponsorWall.naturalHeight, x, y, w, h);
    } else {
      ctx.fillStyle = index % 2 ? "#ffffff" : "#b8121b";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = index % 2 ? "#b8121b" : "#ffffff";
      ctx.font = "900 16px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sponsorLabels[index % sponsorLabels.length], x + w / 2, y + h / 2);
    }

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillRect(x, y, w, 6);
    ctx.strokeStyle = "rgba(23,23,23,0.28)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function drawStadium() {
    if (fieldImage.complete && fieldImage.naturalWidth) {
      ctx.drawImage(fieldImage, 0, 0, WIDTH, HEIGHT);
      for (let x = 18, i = 0; x < WIDTH; x += 178, i += 1) {
        drawSponsorBoard(x, 326, 148, 34, i);
      }
      return;
    }

    const sky = ctx.createLinearGradient(0, 0, 0, 320);
    sky.addColorStop(0, "#120407");
    sky.addColorStop(0.42, "#3b0d13");
    sky.addColorStop(1, "#171717");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, 320);

    for (let i = 0; i < 118; i += 1) {
      const x = (i * 61) % WIDTH;
      const y = 70 + ((i * 37) % 150);
      ctx.fillStyle = i % 3 === 0 ? "rgba(184,18,27,0.45)" : "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#b8121b";
    ctx.fillRect(0, 232, WIDTH, 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = "42px 'Bebas Neue', Impact, sans-serif";
    ctx.fillText("TSV Plattenhardt", 36, 270);
    ctx.font = "900 15px Inter, sans-serif";
    ctx.fillText("PFINGSTTURNIER 2026  /  WEILERHAU", 330, 264);

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 284, WIDTH, 38);
    for (let x = 0; x < WIDTH; x += 46) {
      ctx.fillStyle = x % 92 === 0 ? "#ffffff" : "#b8121b";
      ctx.fillRect(x, 288, 24, 30);
    }

    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.fillRect(0, 324, WIDTH, 30);
    for (let x = 18, i = 0; x < WIDTH; x += 178, i += 1) {
      drawSponsorBoard(x, 326, 148, 34, i);
    }
  }

  function drawPitch() {
    if (fieldImage.complete && fieldImage.naturalWidth) return;

    const grass = ctx.createLinearGradient(0, 322, 0, HEIGHT);
    grass.addColorStop(0, "#38a85c");
    grass.addColorStop(0.42, "#208447");
    grass.addColorStop(1, "#0d512e");
    ctx.fillStyle = grass;
    ctx.fillRect(0, 360, WIDTH, HEIGHT - 360);

    for (let i = -5; i < 13; i += 1) {
      const topX = WIDTH / 2 + i * 48;
      const bottomX = WIDTH / 2 + i * 112;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.045)";
      ctx.beginPath();
      ctx.moveTo(topX, 360);
      ctx.lineTo(topX + 46, 360);
      ctx.lineTo(bottomX + 108, HEIGHT);
      ctx.lineTo(bottomX - 10, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(54, HEIGHT);
    ctx.quadraticCurveTo(WIDTH / 2, 506, WIDTH - 54, HEIGHT);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 2;
    for (let y = 395; y < HEIGHT; y += 58) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(WIDTH / 2, y + 30, WIDTH, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(355, 360);
    ctx.lineTo(150, HEIGHT);
    ctx.moveTo(765, 360);
    ctx.lineTo(970, HEIGHT);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 646, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 3;
    roundedRect(274, 360, 572, 146, 2);
    ctx.stroke();

    for (let i = 0; i < 140; i += 1) {
      const x = (i * 83) % WIDTH;
      const y = 374 + ((i * 47) % 320);
      const fade = (y - 360) / 360;
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + fade * 0.055})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y - 8);
      ctx.stroke();
    }

    const vignette = ctx.createRadialGradient(WIDTH / 2, 520, 120, WIDTH / 2, 520, 660);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 360, WIDTH, HEIGHT - 360);
  }

  function drawGoal() {
    if (fieldImage.complete && fieldImage.naturalWidth) return;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    for (let x = goal.x + 38; x < goal.x + goal.w; x += 38) {
      ctx.beginPath();
      ctx.moveTo(x, goal.y);
      ctx.lineTo(x, goal.y + goal.h);
      ctx.stroke();
    }
    for (let y = goal.y + 32; y < goal.y + goal.h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(goal.x, y);
      ctx.lineTo(goal.x + goal.w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 14;
    ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
    ctx.strokeStyle = "#b8121b";
    ctx.lineWidth = 4;
    ctx.strokeRect(goal.x + 10, goal.y + 10, goal.w - 20, goal.h - 20);
    ctx.restore();
  }

  function drawTargets() {
    targets.forEach((target, index) => {
      const pulse = Math.sin(state.time * 0.05 + index) * 0.12 + 1;
      const hit = state.targetHit === target.id;

      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.scale(hit ? 1.24 : pulse, hit ? 1.24 : pulse);
      if (targetImage.complete && targetImage.naturalWidth) {
        ctx.drawImage(targetImage, -target.r, -target.r, target.r * 2, target.r * 2);
      } else {
        ctx.fillStyle = "rgba(184,18,27,0.9)";
        ctx.beginPath();
        ctx.arc(0, 0, target.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, target.r - 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 17px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${target.points}`, 0, 0);
      ctx.restore();
    });
  }

  function currentKeeperFrame() {
    const reach = state.keeper.reach;
    const absReach = Math.abs(reach);

    if (state.shotActive && absReach > 0.42) {
      return reach < 0 ? keeperFrames.diveLeft : keeperFrames.diveRight;
    }

    if (absReach > 0.16) {
      return reach < 0 ? keeperFrames.readyLeft : keeperFrames.readyRight;
    }

    return Math.floor(state.time / 28) % 2 ? keeperFrames.idleB : keeperFrames.idleA;
  }

  function drawKeeper() {
    const keeper = state.keeper;
    const x = keeper.x;
    const y = keeper.y;
    const frame = currentKeeperFrame();
    const spriteReady = frame.complete && frame.naturalWidth;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 86, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y);
    ctx.rotate(keeper.reach * 0.045);

    if (state.keeper.saveFlash > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${state.keeper.saveFlash / 20})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -4, 112 + state.keeper.saveFlash * 2, -0.9, Math.PI + 0.9);
      ctx.stroke();
    }

    if (spriteReady) {
      const reach = Math.abs(keeper.reach);
      const spriteH = state.shotActive && reach > 0.35 ? 210 : 192;
      const spriteW = spriteH * (frame.naturalWidth / frame.naturalHeight);
      ctx.drawImage(frame, -spriteW / 2, -spriteH, spriteW, spriteH);
      ctx.restore();
      return;
    }

    const lean = keeper.reach * 28;
    ctx.strokeStyle = "#f4f4f4";
    ctx.lineWidth = 15;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-34, -18);
    ctx.lineTo(-104 - lean, -64);
    ctx.moveTo(34, -18);
    ctx.lineTo(104 - lean, -64);
    ctx.stroke();
    ctx.fillStyle = "#f4f4f4";
    ctx.beginPath();
    ctx.arc(-112 - lean, -68, 15, 0, Math.PI * 2);
    ctx.arc(112 - lean, -68, 15, 0, Math.PI * 2);
    ctx.fill();

    const shirt = ctx.createLinearGradient(-44, -40, 44, 76);
    shirt.addColorStop(0, "#213a8f");
    shirt.addColorStop(0.46, "#213a8f");
    shirt.addColorStop(0.47, "#b8121b");
    shirt.addColorStop(0.64, "#b8121b");
    shirt.addColorStop(0.65, "#213a8f");
    shirt.addColorStop(1, "#213a8f");
    ctx.fillStyle = shirt;
    roundedRect(-44, -42, 88, 118, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#14245f";
    roundedRect(-42, 68, 34, 78, 10);
    roundedRect(8, 68, 34, 78, 10);
    ctx.fill();

    ctx.fillStyle = "#f4f4f4";
    roundedRect(-48 - lean * 0.22, 138, 50, 14, 7);
    roundedRect(0 - lean * 0.22, 138, 50, 14, 7);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TSV", 0, 18);

    ctx.fillStyle = "#f3d2b8";
    ctx.beginPath();
    ctx.arc(0, -68, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#171717";
    ctx.beginPath();
    ctx.ellipse(0, -87, 25, 10, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7f0d13";
    ctx.fillRect(-16, -66, 32, 5);
    ctx.restore();
  }

  function drawAim() {
    if (!state.aiming) return;

    const aim = aimVector();
    const power = aim.power;
    const endX = state.start.x + aim.dx * 1.45;
    const endY = state.start.y + aim.dy * 1.25;
    const bendX = state.start.x + aim.dx * 0.55;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.48)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(state.dragStart.x, state.dragStart.y);
    ctx.lineTo(state.pointer.x, state.pointer.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(184,18,27,0.92)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(state.start.x, state.start.y);
    ctx.quadraticCurveTo(bendX, 420, endX, Math.max(110, endY));
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.setLineDash([13, 11]);
    ctx.beginPath();
    ctx.moveTo(state.start.x, state.start.y);
    ctx.quadraticCurveTo(bendX, 420, endX, Math.max(110, endY));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(endX, Math.max(110, endY), 18 + power * 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b8121b";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "rgba(184,18,27,0.9)";
    roundedRect(state.start.x - 62, state.start.y + 36, 124, 28, 14);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(power * 100)}%`, state.start.x, state.start.y + 56);
    ctx.restore();
  }

  function drawBall() {
    const ball = state.ball;

    ball.trail.forEach((dot, index) => {
      ctx.fillStyle = `rgba(255,255,255,${0.24 - index * 0.017})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r + index * 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    if (ballImage.complete && ballImage.naturalWidth) {
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.age * 0.16 + ball.spin * 0.9);
      ctx.shadowColor = "rgba(0,0,0,0.34)";
      ctx.shadowBlur = 14;
      ctx.drawImage(ballImage, -ball.r, -ball.r, ball.r * 2, ball.r * 2);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.34)";
    ctx.shadowBlur = 16;
    const ballLight = ctx.createRadialGradient(ball.x - ball.r * 0.35, ball.y - ball.r * 0.45, 2, ball.x, ball.y, ball.r);
    ballLight.addColorStop(0, "#ffffff");
    ballLight.addColorStop(0.72, "#f1f1f1");
    ballLight.addColorStop(1, "#cfcfcf");
    ctx.fillStyle = ballLight;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.clip();

    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.age * 0.15 + ball.spin * 0.8);

    ctx.fillStyle = "#161616";
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const radius = ball.r * 0.34;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const cx = Math.cos(angle) * ball.r * 0.72;
      const cy = Math.sin(angle) * ball.r * 0.72;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = "#171717";
      ctx.beginPath();
      for (let j = 0; j < 5; j += 1) {
        const panelAngle = -Math.PI / 2 + (j * Math.PI * 2) / 5;
        const panelRadius = ball.r * 0.23;
        const px = Math.cos(panelAngle) * panelRadius;
        const py = Math.sin(panelAngle) * panelRadius;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const ratio = Math.max(1, window.devicePixelRatio || 1);
    ctx.setTransform(ratio * view.scale, 0, 0, ratio * view.scale, ratio * view.offsetX, ratio * view.offsetY);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#171717";
    ctx.lineWidth = Math.max(2, ball.r * 0.15);
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    state.particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0, particle.life / 54);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawFlash() {
    if (state.flash <= 0) return;
    ctx.fillStyle = `rgba(184,18,27,${state.flash / 70})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function draw() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    drawStadium();
    drawPitch();
    drawGoal();
    drawTargets();
    drawKeeper();
    drawAim();
    drawBall();
    drawParticles();
    drawFlash();
  }

  function loop() {
    updateGame();
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", startAim);
  canvas.addEventListener("pointermove", moveAim);
  canvas.addEventListener("pointerup", releaseShot);
  canvas.addEventListener("pointercancel", () => {
    state.aiming = false;
    if (powerNode) powerNode.style.width = "0%";
  });
  restartButton?.addEventListener("click", restartGame);
  startButton?.addEventListener("click", () => {
    rememberPlayerName();
    updatePlayerDisplay();
    startPanel?.classList.add("is-hidden");
    restartGame();
  });
  playerNameNode?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") startButton?.click();
  });
  playerNameNode?.addEventListener("change", () => {
    state.round = 0;
    rememberPlayerName();
    updatePlayerDisplay();
    if (state.started) restartGame();
  });
  playerNameNode?.addEventListener("input", () => {
    rememberPlayerName();
    updatePlayerDisplay();
  });
  window.addEventListener("resize", resizeCanvas);

  setupMenu();
  restorePlayerName();
  resizeCanvas();
  renderLeaderboard();
  updateModeStatus();
  writeHud();
  playerNameNode?.focus();
  loop();
})();
