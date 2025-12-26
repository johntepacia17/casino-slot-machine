import * as PIXI from "pixi.js";

import bgUrl from "./assets/bg.png";
import panelUrl from "./assets/canvas.png";
import reelOverlayUrl from "./assets/overlay.png";

import s1 from "./assets/1.png";
import s2 from "./assets/2.png";
import s3 from "./assets/3.png";
import s4 from "./assets/4.png";
import s5 from "./assets/5.png";
import s6 from "./assets/6.png";
import s7 from "./assets/7.png";
import s8 from "./assets/8.png";
import s9 from "./assets/9.png";
import s10 from "./assets/10.png";
import s11 from "./assets/11.png";
import s12 from "./assets/12.png";
import s13 from "./assets/13.png";
import s14 from "./assets/14.png";
import s15 from "./assets/15.png";

import spinBtnUrl from "./assets/spin-button.png";
import addBetUrl from "./assets/add-bet.png";
import minusBetUrl from "./assets/minus-bet.png";

// HUD icons
import infoIconUrl from "./assets/info.png";
import soundIconUrl from "./assets/sound.png";
import expandIconUrl from "./assets/expand.png";

// SFX
import clickSpinSfxUrl from "./assets/click_spin.mp3";
import fallIconsSfxUrl from "./assets/fall_icons.mp3";
import threeLinesSfxUrl from "./assets/3lines.mp3";
import fiveLinesSfxUrl from "./assets/5lines.mp3";

/**
 * SLOT MACHINE (5 reels x 3 visible rows)
 */

// ------------------------------------
// Config
// ------------------------------------
const REELS = 5;
const ROWS = 3;

const SYMBOL_SIZE = 110;
const REEL_GAP = 14;

const WIN_PAUSE_MS = 1500;

// Normal spin
const SPIN_TIME_MIN = 900;
const SPIN_TIME_MAX = 1400;

// Turbo spin (faster)
const TURBO_SPIN_TIME_MIN = 240;
const TURBO_SPIN_TIME_MAX = 380;

const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

// Reels viewport
const REELS_VIEW_W = 750;
const REELS_VIEW_H = 436;

const PANEL_PAD = 0;
const PANEL_INNER_PAD = 0;

// Derived grid sizes
const frameW = REELS * SYMBOL_SIZE + (REELS - 1) * REEL_GAP;
const frameH = ROWS * SYMBOL_SIZE;

// Center 5x3 grid inside viewport
const REEL_X_OFFSET = Math.floor((REELS_VIEW_W - frameW) / 2);
const REEL_Y_OFFSET = Math.floor((REELS_VIEW_H - frameH) / 2);

// ------------------------------------
// Pixi App
// ------------------------------------
const app = new PIXI.Application();
await app.init({
  backgroundAlpha: 0,
  antialias: true,
  resizeTo: window,
});

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(app.canvas);

// ------------------------------------
// Helpers
// ------------------------------------
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function easeOutCubic(t) {
  t = clamp01(t);
  return 1 - Math.pow(1 - t, 3);
}

// Background cover (fill screen)
function fitSpriteCover(sprite, screenW, screenH) {
  const texW = sprite.texture.width;
  const texH = sprite.texture.height;

  const scale = Math.max(screenW / texW, screenH / texH);
  sprite.scale.set(scale);

  sprite.x = Math.floor((screenW - texW * scale) / 2);
  sprite.y = Math.floor((screenH - texH * scale) / 2);

  return { x: sprite.x, y: sprite.y, width: texW * scale, height: texH * scale };
}

/**
 * Fit icon sprite inside a cell (ONLY scale + center).
 * NOTE: cell container is positioned by reel logic; we do NOT touch cell.y here.
 */
function fitIconInCell(iconSprite, cellSize, pad = 12) {
  const maxW = cellSize - pad * 2;
  const maxH = cellSize - pad * 2;

  const tw = iconSprite.texture.width;
  const th = iconSprite.texture.height;

  const scale = Math.min(maxW / tw, maxH / th);
  iconSprite.scale.set(scale);

  iconSprite.anchor.set(0.5);
  iconSprite.x = cellSize / 2;
  iconSprite.y = cellSize / 2;
}

// Image buttons
function createImageButton(texture, onClick, baseScale = 1) {
  const btn = new PIXI.Sprite(texture);
  btn.anchor.set(0.5);
  btn.scale.set(baseScale);
  btn.eventMode = "static";
  btn.cursor = "pointer";
  btn._enabled = true;

  btn.on("pointertap", () => {
    if (btn._enabled) onClick();
  });

  btn.on("pointerover", () => btn._enabled && btn.scale.set(baseScale * 1.05));
  btn.on("pointerout", () => btn.scale.set(baseScale));
  btn.on("pointerdown", () => btn._enabled && btn.scale.set(baseScale * 0.95));
  btn.on("pointerup", () => btn._enabled && btn.scale.set(baseScale * 1.05));

  return btn;
}

function setButtonEnabled(btn, enabled) {
  btn._enabled = enabled;
  btn.alpha = enabled ? 1 : 0.5;
  btn.cursor = enabled ? "pointer" : "default";
}

// ------------------------------------
// Fullscreen helper (expand icon)
// ------------------------------------
function isFullscreen() {
  return !!document.fullscreenElement;
}
function requestFullscreen() {
  if (isFullscreen()) return;
  const el = document.documentElement; // fullscreen entire page
  el?.requestFullscreen?.().catch(() => {});
}

// ------------------------------------
// SFX (simple audio pool)
// ------------------------------------
function makeSfx(src, { volume = 1, maxPolyphony = 3 } = {}) {
  const base = new Audio(src);
  base.preload = "auto";
  base.volume = volume;

  const clones = [];
  for (let i = 0; i < Math.max(1, maxPolyphony); i++) {
    const a = base.cloneNode(true);
    a.preload = "auto";
    a.volume = volume;
    clones.push(a);
  }

  return {
    play() {
      const a = clones.find((x) => x.paused || x.ended) || clones[0];
      try {
        a.currentTime = 0;
      } catch {}
      a.play().catch(() => {});
    },
  };
}

const sfx = {
  clickSpin: makeSfx(clickSpinSfxUrl, { volume: 0.9, maxPolyphony: 2 }),
  fallIcons: makeSfx(fallIconsSfxUrl, { volume: 0.9, maxPolyphony: 2 }),
  threeLines: makeSfx(threeLinesSfxUrl, { volume: 0.95, maxPolyphony: 2 }),
  fiveLines: makeSfx(fiveLinesSfxUrl, { volume: 0.95, maxPolyphony: 2 }),
};

// ------------------------------------
// Load textures
// ------------------------------------
const bgTexture = await PIXI.Assets.load(bgUrl);
const panelTexture = await PIXI.Assets.load(panelUrl);
const reelOverlayTexture = await PIXI.Assets.load(reelOverlayUrl);

const iconUrls = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15];
const iconTextures = await Promise.all(iconUrls.map((u) => PIXI.Assets.load(u)));

const SYMBOLS = iconTextures.map((t, id) => ({ id, texture: t }));
const randomSymbolId = () => randInt(0, SYMBOLS.length - 1);

// Button textures
const spinBtnTexture = await PIXI.Assets.load(spinBtnUrl);
const addBetTexture = await PIXI.Assets.load(addBetUrl);
const minusBetTexture = await PIXI.Assets.load(minusBetUrl);

// HUD icon textures
const infoIconTexture = await PIXI.Assets.load(infoIconUrl);
const soundIconTexture = await PIXI.Assets.load(soundIconUrl);
const expandIconTexture = await PIXI.Assets.load(expandIconUrl);

// ------------------------------------
// Background
// ------------------------------------
const bgSprite = new PIXI.Sprite(bgTexture);
bgSprite.anchor.set(0, 0);
app.stage.addChild(bgSprite);

// ------------------------------------
// Main containers
// ------------------------------------
const root = new PIXI.Container();
app.stage.addChild(root);

const machine = new PIXI.Container();
root.addChild(machine);

// Reels viewport (holds reels + overlay + dim + highlights)
const reelsViewport = new PIXI.Container();
machine.addChild(reelsViewport);

// Panel behind reels viewport
const panelSprite = new PIXI.Sprite(panelTexture);
panelSprite.anchor.set(0, 0);
machine.addChildAt(panelSprite, 0);

// Reel area holds the reel columns
const reelArea = new PIXI.Container();
reelsViewport.addChild(reelArea);

// Overlay image above symbols
const reelOverlaySprite = new PIXI.Sprite(reelOverlayTexture);
reelOverlaySprite.anchor.set(0, 0);
reelsViewport.addChild(reelOverlaySprite);

// Dim overlay INSIDE viewport (UNDER lines/text/highlights)
const dimOverlay = new PIXI.Graphics();
dimOverlay.visible = false;
dimOverlay.alpha = 0;
reelsViewport.addChild(dimOverlay);

// Highlights + paylines + win texts (above dim)
const highlightLayer = new PIXI.Container();
reelsViewport.addChild(highlightLayer);

// Optional separators
const separators = new PIXI.Graphics();
reelsViewport.addChild(separators);

function drawSeparators() {
  separators.clear();
  for (let i = 1; i < REELS; i++) {
    const x = REEL_X_OFFSET + i * SYMBOL_SIZE + (i - 0.5) * REEL_GAP;
    separators
      .rect(x - 2, REEL_Y_OFFSET - PANEL_INNER_PAD, 4, frameH + PANEL_INNER_PAD * 2)
      .fill({ color: 0xffffff, alpha: 0.12 });
  }
}

// ------------------------------------
// Masks (clip reelArea + highlights to visible grid)
// ------------------------------------
const reelMask = new PIXI.Graphics().rect(0, 0, frameW, frameH).fill({ color: 0xffffff, alpha: 1 });
reelArea.mask = reelMask;
reelArea.addChild(reelMask);

const highlightMask = new PIXI.Graphics().rect(0, 0, frameW, frameH).fill({ color: 0xffffff, alpha: 1 });
highlightLayer.mask = highlightMask;
highlightLayer.addChild(highlightMask);

// ------------------------------------
// Reels
// ------------------------------------
const reels = [];
const EXTRA_SYMBOLS = 8;

function createSymbolCell(id) {
  const cell = new PIXI.Container();
  cell._symbolId = id;

  const icon = new PIXI.Sprite(SYMBOLS[id].texture);
  fitIconInCell(icon, SYMBOL_SIZE, 14);

  cell._icon = icon;
  cell.addChild(icon);

  return cell;
}

function setSymbolCell(cell, newId) {
  cell._symbolId = newId;
  cell._icon.texture = SYMBOLS[newId].texture;
  fitIconInCell(cell._icon, SYMBOL_SIZE, 14);
}

function createReel(col) {
  const c = new PIXI.Container();
  c.x = col * (SYMBOL_SIZE + REEL_GAP);
  reelArea.addChild(c);

  const symbols = [];
  const total = ROWS + EXTRA_SYMBOLS;

  for (let i = 0; i < total; i++) {
    const id = randomSymbolId();
    const cell = createSymbolCell(id);
    cell.x = 0;
    cell.y = (i - EXTRA_SYMBOLS) * SYMBOL_SIZE;
    c.addChild(cell);
    symbols.push(cell);
  }

  const blur = new PIXI.BlurFilter();
  blur.blurX = 0;
  blur.blurY = 0;
  c.filters = [blur];

  return {
    col,
    container: c,
    symbols,
    blur,
    position: 0,
    previousPosition: 0,
    tween: null,
    resultIds: Array(ROWS).fill(0),
  };
}

for (let i = 0; i < REELS; i++) reels.push(createReel(i));

// ------------------------------------
// HUD
// ------------------------------------
const hud = new PIXI.Container();
machine.addChild(hud);

// HUD icons (left side)
const infoIcon = new PIXI.Sprite(infoIconTexture);
infoIcon.anchor.set(0, 0.5);
infoIcon.scale.set(0.45);
infoIcon.eventMode = "static";
infoIcon.cursor = "pointer";
hud.addChild(infoIcon);

const soundIcon = new PIXI.Sprite(soundIconTexture);
soundIcon.anchor.set(0, 0.5);
soundIcon.scale.set(0.45);
soundIcon.eventMode = "static";
soundIcon.cursor = "pointer";
hud.addChild(soundIcon);

const expandIcon = new PIXI.Sprite(expandIconTexture);
expandIcon.anchor.set(0, 0.5);
expandIcon.scale.set(0.45);
expandIcon.eventMode = "static";
expandIcon.cursor = "pointer";
hud.addChild(expandIcon);

//Expand => fullscreen. Exit via ESC is native browser behavior.
expandIcon.on("pointertap", () => {
  requestFullscreen();
});

// CREDIT
const creditLabel = new PIXI.Text({
  text: "CREDIT",
  style: { fontFamily: "Arial", fontWeight: "900", fontSize: Math.floor(16 * DPR), fill: 0x90f200 },
});
const creditValue = new PIXI.Text({
  text: "$100,000.00",
  style: { fontFamily: "Arial", fontWeight: "900", fontSize: Math.floor(16 * DPR), fill: 0xffffff },
});
hud.addChild(creditLabel, creditValue);

// BET
const betLabel = new PIXI.Text({
  text: "BET",
  style: { fontFamily: "Arial", fontWeight: "900", fontSize: Math.floor(16 * DPR), fill: 0x90f200 },
});
const betValue = new PIXI.Text({
  text: "$20",
  style: { fontFamily: "Arial", fontWeight: "900", fontSize: Math.floor(16 * DPR), fill: 0xffffff },
});
hud.addChild(betLabel, betValue);

// Middle texts
const spinForWinText = new PIXI.Text({
  text: "SPIN FOR THE WIN",
  style: { fontFamily: "Arial", fontWeight: "900", fontSize: Math.floor(30 * DPR), fill: 0xffffff, align: "center" },
});
spinForWinText.anchor.set(0.5, 0);
hud.addChild(spinForWinText);

const turboSpinText = new PIXI.Text({
  text: "HOLD SPACE FOR TURBO SPIN",
  style: { fontFamily: "Arial", fontWeight: "900", fontSize: Math.floor(15 * DPR), fill: 0x90f200, align: "center" },
});
turboSpinText.anchor.set(0.5, 0);
hud.addChild(turboSpinText);

// Turbo indicator
const turboIndicator = new PIXI.Text({
  text: "TURBO",
  style: {
    fontFamily: "Arial",
    fontWeight: "900",
    fontSize: Math.floor(14 * DPR),
    fill: 0x90f200,
    align: "center",
  },
});
turboIndicator.anchor.set(0.5, 0.5);
turboIndicator.visible = false;
hud.addChild(turboIndicator);

let credit = 100000.0;
let bet = 20;

function renderHud() {
  creditValue.text = `$${credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  betValue.text = `$${bet}`;
}

// Buttons (scaled down)
const minusBtn = createImageButton(
  minusBetTexture,
  () => {
    if (isSpinning) return;
    bet = Math.max(1, bet - 1);
    renderHud();
  },
  0.55
);

const spinButton = createImageButton(
  spinBtnTexture,
  () => {
    if (isSpinning) return;
    sfx.clickSpin.play();
    spin({ turbo: false, from: "button" });
  },
  0.6
);

const plusBtn = createImageButton(
  addBetTexture,
  () => {
    if (isSpinning) return;
    bet = Math.min(999, bet + 1);
    renderHud();
  },
  0.55
);

hud.addChild(minusBtn, spinButton, plusBtn);

// ------------------------------------
// Turbo spin (SPACE hold)
// ------------------------------------
let turboHeld = false;
let turboLoopArmed = false;

function setTurboUI(on) {
  turboIndicator.visible = !!on;
  turboSpinText.alpha = on ? 1 : 0.85;
}

window.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  e.preventDefault();

  if (!turboHeld) {
    turboHeld = true;
    setTurboUI(true);

    if (!isSpinning) {
      turboLoopArmed = true;
      spin({ turbo: true, from: "turbo" });
    } else {
      turboLoopArmed = true;
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code !== "Space") return;
  e.preventDefault();

  turboHeld = false;
  turboLoopArmed = false;
  setTurboUI(false);
});

// ------------------------------------
// Reel ticker update
// ------------------------------------
let allowWrapRandomize = true;

app.ticker.add(() => {
  for (const reel of reels) {
    if (!reel.tween) continue;

    const delta = reel.position - reel.previousPosition;
    reel.previousPosition = reel.position;
    reel.blur.blurY = Math.abs(delta) * 10;

    updateReelSymbols(reel);
  }
});

function updateReelSymbols(reel) {
  const total = reel.symbols.length;
  const totalH = total * SYMBOL_SIZE;

  // baseY grows as reel.position grows (downward)
  const baseY = (reel.position % total) * SYMBOL_SIZE;

  for (let i = 0; i < total; i++) {
    const cell = reel.symbols[i];

    // evenly spaced, always fills rows (no gaps)
    let y = (i * SYMBOL_SIZE + baseY) % totalH;
    y -= EXTRA_SYMBOLS * SYMBOL_SIZE;

    const prevY = cell._prevY ?? y;
    cell._prevY = y;

    // randomize ONLY when a cell wraps from bottom back to top
    if (allowWrapRandomize && prevY > y + totalH * 0.5) {
      setSymbolCell(cell, randomSymbolId());
    }

    cell.y = y;
  }
}

// ------------------------------------
// Spin flow
// ------------------------------------
let isSpinning = false;

async function spin({ turbo = false, from = "button" } = {}) {
  if (isSpinning) return;

  isSpinning = true;
  allowWrapRandomize = true;

  setButtonEnabled(spinButton, false);
  clearWinVisuals();
  renderHud();

  credit = Math.max(0, credit - bet);
  renderHud();

  sfx.fallIcons.play();

  const timeMin = turbo ? TURBO_SPIN_TIME_MIN : SPIN_TIME_MIN;
  const timeMax = turbo ? TURBO_SPIN_TIME_MAX : SPIN_TIME_MAX;

  const spinPromises = [];
  for (let i = 0; i < reels.length; i++) {
    const reel = reels[i];

    const time = randInt(timeMin, timeMax) + i * (turbo ? 60 : 180);
    const baseTurns = turbo ? 10 : 18;
    const perReelTurns = turbo ? 2 : 3;
    const extraTurns = baseTurns + i * perReelTurns + randInt(0, turbo ? 1 : 3);

    const target = reel.position + extraTurns;
    spinPromises.push(tweenReelTo(reel, target, time));
  }

  await Promise.all(spinPromises);

  // hard “final pass” so we never end with gaps
  allowWrapRandomize = false;
  for (const r of reels) updateReelSymbols(r);

  finalizeResults();

  for (const r of reels) {
    r.previousPosition = r.position;
    r.blur.blurY = 0;
  }

  const win = checkWin();

  if (win.totalValue > 0) {
    const hasFive = win.patterns.some((p) => p?.points?.length === 5 && p.value === 5.0);
    const hasThree = win.patterns.some((p) => p?.points?.length === 3 && p.value === 2.5);

    if (hasFive) sfx.fiveLines.play();
    else if (hasThree) sfx.threeLines.play();

    credit += win.totalValue;
    renderHud();

    showWinVisuals(win);

    if (turbo || turboHeld) {
      await showDimOverlayAndPauseFast();
    } else {
      await showDimOverlayAndPause();
    }
  }

  isSpinning = false;
  setButtonEnabled(spinButton, true);
  renderHud();

  if (turboLoopArmed && turboHeld) {
    requestAnimationFrame(() => {
      if (!isSpinning && turboHeld) spin({ turbo: true, from: "turbo" });
    });
  }
}

function tweenReelTo(reel, targetPosition, timeMs) {
  reel.tween = null;

  const start = performance.now();
  const startPos = reel.position;

  return new Promise((resolve) => {
    reel.tween = () => {
      const now = performance.now();
      const t = (now - start) / timeMs;
      const eased = easeOutCubic(t);
      reel.position = lerp(startPos, targetPosition, eased);

      if (t >= 1) {
        reel.position = Math.round(targetPosition);
        updateReelSymbols(reel); // snap
        reel.blur.blurY = 0;
        reel.tween = null;
        resolve();
      }
    };

    const step = () => {
      if (!reel.tween) return;
      reel.tween();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function getVisibleSymbols(reel) {
  const visible = reel.symbols
    .filter((cell) => cell.y >= 0 && cell.y < ROWS * SYMBOL_SIZE)
    .sort((a, b) => a.y - b.y);

  if (visible.length !== ROWS) {
    const byRow = [];
    for (let r = 0; r < ROWS; r++) {
      const targetY = r * SYMBOL_SIZE + SYMBOL_SIZE / 2;
      let best = null;
      let bestDist = Infinity;

      for (const cell of reel.symbols) {
        const mid = cell.y + SYMBOL_SIZE / 2;
        const d = Math.abs(mid - targetY);
        if (d < bestDist) {
          bestDist = d;
          best = cell;
        }
      }
      byRow.push(best);
    }
    return [...new Set(byRow)].slice(0, ROWS);
  }

  return visible;
}

function finalizeResults() {
  for (const reel of reels) {
    const visible = getVisibleSymbols(reel);
    for (let row = 0; row < ROWS; row++) {
      reel.resultIds[row] = visible[row]._symbolId;
    }
  }
}

// ------------------------------------
// Win logic
// ------------------------------------
function buildResultGrid() {
  const grid = Array.from({ length: ROWS }, () => Array(REELS).fill(0));
  for (let col = 0; col < REELS; col++) {
    for (let row = 0; row < ROWS; row++) {
      grid[row][col] = reels[col].resultIds[row];
    }
  }
  return grid;
}

function checkWin() {
  const grid = buildResultGrid();
  let totalValue = 0;

  const winningCellsSet = new Set();
  const patterns = [];

  const addCell = (row, col) => winningCellsSet.add(`${row}:${col}`);
  const addPattern = (points, value) => {
    patterns.push({ points, value });
    for (const p of points) addCell(p.row, p.col);
    totalValue += value;
  };

  // Horizontal
  for (let row = 0; row < ROWS; row++) {
    const rowIds = grid[row];

    const allSame = rowIds.every((id) => id === rowIds[0]);
    if (allSame) {
      addPattern(
        Array.from({ length: REELS }, (_, col) => ({ row, col })),
        5.0
      );
      continue;
    }

    for (let start = 0; start <= REELS - 3; start++) {
      const a = rowIds[start];
      const b = rowIds[start + 1];
      const c = rowIds[start + 2];
      if (a === b && b === c) {
        addPattern(
          [
            { row, col: start },
            { row, col: start + 1 },
            { row, col: start + 2 },
          ],
          2.5
        );
        break;
      }
    }
  }

  // Diagonal 3-in-a-row
  for (let startCol = 0; startCol <= REELS - 3; startCol++) {
    // Down-right
    {
      const a = grid[0][startCol];
      const b = grid[1][startCol + 1];
      const c = grid[2][startCol + 2];
      if (a === b && b === c) {
        addPattern(
          [
            { row: 0, col: startCol },
            { row: 1, col: startCol + 1 },
            { row: 2, col: startCol + 2 },
          ],
          2.5
        );
      }
    }

    // Up-right
    {
      const a = grid[2][startCol];
      const b = grid[1][startCol + 1];
      const c = grid[0][startCol + 2];
      if (a === b && b === c) {
        addPattern(
          [
            { row: 2, col: startCol },
            { row: 1, col: startCol + 1 },
            { row: 0, col: startCol + 2 },
          ],
          2.5
        );
      }
    }
  }

  const winningCells = [...winningCellsSet].map((k) => {
    const [row, col] = k.split(":").map(Number);
    return { row, col };
  });

  return { totalValue, winningCells, patterns };
}

// ------------------------------------
// Win visuals
// ------------------------------------
const patternValueTexts = [];

function ensurePatternText(i) {
  if (!patternValueTexts[i]) {
    const t = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Arial",
        fontWeight: "900",
        fontSize: Math.floor(22 * DPR),
        fill: 0x90f200,
        align: "center",
        dropShadow: true,
        dropShadowDistance: 0,
        dropShadowBlur: 12,
        dropShadowAlpha: 0.9,
      },
    });
    t.anchor.set(0.5, 0.5);
    t.visible = false;
    patternValueTexts[i] = t;
  }
  const t = patternValueTexts[i];
  if (t.parent !== highlightLayer) highlightLayer.addChild(t);
  return t;
}

function clearWinVisuals() {
  highlightLayer.removeChildren();
  highlightLayer.addChild(highlightMask);

  for (const t of patternValueTexts) {
    if (t) t.visible = false;
  }
}

function cellCenter(row, col) {
  return {
    x: REEL_X_OFFSET + col * (SYMBOL_SIZE + REEL_GAP) + SYMBOL_SIZE / 2,
    y: REEL_Y_OFFSET + row * SYMBOL_SIZE + SYMBOL_SIZE / 2,
  };
}

function showWinVisuals(win) {
  clearWinVisuals();

  for (const { row, col } of win.winningCells) {
    const x = REEL_X_OFFSET + col * (SYMBOL_SIZE + REEL_GAP);
    const y = REEL_Y_OFFSET + row * SYMBOL_SIZE;

    const glow = new PIXI.Graphics();
    glow.roundRect(x + 5, y + 5, SYMBOL_SIZE - 10, SYMBOL_SIZE - 10, 16).stroke({
      width: 10,
      color: 0xfff1a8,
      alpha: 0.25,
    });
    glow.filters = [new PIXI.BlurFilter({ strength: 7 })];

    const box = new PIXI.Graphics();
    box.roundRect(x + 8, y + 8, SYMBOL_SIZE - 16, SYMBOL_SIZE - 16, 14).stroke({
      width: 3,
      color: 0xffe26b,
      alpha: 0.95,
    });

    highlightLayer.addChild(glow, box);
  }

  for (let i = 0; i < win.patterns.length; i++) {
    const p = win.patterns[i];
    if (!p.points?.length) continue;

    const pts = p.points.map((pt) => cellCenter(pt.row, pt.col));
    const first = pts[0];
    const last = pts[pts.length - 1];

    const glowLine = new PIXI.Graphics();
    glowLine.moveTo(first.x, first.y);
    for (let k = 1; k < pts.length; k++) glowLine.lineTo(pts[k].x, pts[k].y);
    glowLine.stroke({ width: 12, color: 0x90f200, alpha: 0.18 });
    glowLine.filters = [new PIXI.BlurFilter({ strength: 8 })];

    const sharpLine = new PIXI.Graphics();
    sharpLine.moveTo(first.x, first.y);
    for (let k = 1; k < pts.length; k++) sharpLine.lineTo(pts[k].x, pts[k].y);
    sharpLine.stroke({ width: 4, color: 0x90f200, alpha: 0.95 });

    highlightLayer.addChild(glowLine, sharpLine);

    const midX = (first.x + last.x) / 2;
    const midY = (first.y + last.y) / 2;

    const t = ensurePatternText(i);
    t.text = `$${p.value.toFixed(1)}`;
    t.x = midX;
    t.y = midY - Math.floor(18 * DPR);
    t.visible = true;
  }

  for (let i = win.patterns.length; i < patternValueTexts.length; i++) {
    if (patternValueTexts[i]) patternValueTexts[i].visible = false;
  }
}

// ------------------------------------
// Dim overlay (normal)
// ------------------------------------
async function showDimOverlayAndPause() {
  dimOverlay.clear().rect(0, 0, REELS_VIEW_W, REELS_VIEW_H).fill({ color: 0x000000, alpha: 0.78 });
  dimOverlay.visible = true;
  dimOverlay.alpha = 0;

  await new Promise((resolve) => {
    const fadeStart = performance.now();
    const fadeMs = 140;

    const fade = () => {
      const t = (performance.now() - fadeStart) / fadeMs;
      dimOverlay.alpha = clamp01(t);
      if (t < 1) requestAnimationFrame(fade);
      else resolve();
    };
    requestAnimationFrame(fade);
  });

  await new Promise((r) => setTimeout(r, WIN_PAUSE_MS));

  dimOverlay.visible = false;
  dimOverlay.alpha = 0;
  clearWinVisuals();
}

// ------------------------------------
// Dim overlay (turbo fast)
// ------------------------------------
async function showDimOverlayAndPauseFast() {
  dimOverlay.clear().rect(0, 0, REELS_VIEW_W, REELS_VIEW_H).fill({ color: 0x000000, alpha: 0.55 });
  dimOverlay.visible = true;
  dimOverlay.alpha = 0;

  await new Promise((resolve) => {
    const fadeStart = performance.now();
    const fadeMs = 80;

    const fade = () => {
      const t = (performance.now() - fadeStart) / fadeMs;
      dimOverlay.alpha = clamp01(t);
      if (t < 1) requestAnimationFrame(fade);
      else resolve();
    };
    requestAnimationFrame(fade);
  });

  await new Promise((r) => setTimeout(r, 300));

  dimOverlay.visible = false;
  dimOverlay.alpha = 0;
  clearWinVisuals();
}

// ------------------------------------
// Layout / Resize
// ------------------------------------
function layout() {
  const W = app.renderer.width;
  const H = app.renderer.height;

  fitSpriteCover(bgSprite, W, H);

  const machineW = REELS_VIEW_W + PANEL_PAD * 2;
  const machineH = REELS_VIEW_H + PANEL_PAD * 2 + 140;

  root.x = Math.floor((W - machineW) / 2);
  root.y = Math.floor((H - machineH) / 2);

  machine.x = PANEL_PAD;
  machine.y = PANEL_PAD;

  reelsViewport.x = 0;
  reelsViewport.y = 0;

  panelSprite.x = -PANEL_PAD;
  panelSprite.y = -PANEL_PAD;
  panelSprite.width = REELS_VIEW_W + PANEL_PAD * 2;
  panelSprite.height = REELS_VIEW_H + PANEL_PAD * 2;

  reelOverlaySprite.x = 0;
  reelOverlaySprite.y = 0;
  reelOverlaySprite.width = REELS_VIEW_W;
  reelOverlaySprite.height = REELS_VIEW_H;

  dimOverlay.x = 0;
  dimOverlay.y = 0;

  reelArea.x = REEL_X_OFFSET;
  reelArea.y = REEL_Y_OFFSET;

  reelMask.x = 0;
  reelMask.y = 0;

  highlightMask.x = REEL_X_OFFSET;
  highlightMask.y = REEL_Y_OFFSET;

  drawSeparators();

  // HUD under viewport
  hud.x = REEL_X_OFFSET;
  hud.y = REELS_VIEW_H + 46;

  // Buttons (right aligned)
  const gap = 18;
  const rightPad = 60;
  const btnTopY = -30;

  const spinW = spinButton.width;
  const betW = minusBtn.width;

  const rightEdgeX = REELS_VIEW_W - rightPad;

  plusBtn.x = rightEdgeX - betW / 2;
  spinButton.x = plusBtn.x - (betW / 2 + gap + spinW / 2);
  minusBtn.x = spinButton.x - (spinW / 2 + gap + betW / 2);

  spinButton.y = btnTopY + spinButton.height / 2;
  const spinTop = spinButton.y - spinButton.height / 2;

  minusBtn.y = spinTop + minusBtn.height / 2;
  plusBtn.y = spinTop + plusBtn.height / 2;

  const leftX = -60;

  // Info icon before CREDIT
  infoIcon.x = leftX;
  infoIcon.y = 20;

  creditLabel.x = infoIcon.x + infoIcon.width + 10;
  creditLabel.y = 10;

  creditValue.x = creditLabel.x + creditLabel.width + 8;
  creditValue.y = creditLabel.y;

  // Sound icon before BET
  soundIcon.x = leftX;
  soundIcon.y = 53;

  betLabel.x = soundIcon.x + soundIcon.width + 10;
  betLabel.y = 40;

  betValue.x = betLabel.x + betLabel.width + 8;
  betValue.y = betLabel.y;

  // Expand icon below sound icon (next line)
  expandIcon.x = leftX;
  expandIcon.y = soundIcon.y + 35;

  // Center texts
  const leftTextAreaX = 0;
  const leftTextAreaW = 260;

  const rightGroupLeft = minusBtn.x - betW / 2;
  const centerAreaLeft = leftTextAreaX + leftTextAreaW;
  const centerAreaRight = rightGroupLeft - 10;
  const centerX = Math.floor((centerAreaLeft + centerAreaRight) / 2);

  spinForWinText.x = centerX - 40;
  spinForWinText.y = 70;

  turboSpinText.x = centerX - 40;
  turboSpinText.y = spinForWinText.y + spinForWinText.height - Math.floor(6 * DPR);

  // turbo indicator (above spin button)
  turboIndicator.x = spinButton.x;
  turboIndicator.y = spinButton.y - spinButton.height / 2 - Math.floor(10 * DPR);
}

window.addEventListener("resize", layout);

// ------------------------------------
// Start
// ------------------------------------
for (const r of reels) updateReelSymbols(r);
finalizeResults();
renderHud();
layout();
