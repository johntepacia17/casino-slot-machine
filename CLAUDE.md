# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

No test framework is installed.

## Architecture

A browser-based 5×3 slot machine game. All game logic lives in a single file: **`src/main.js`** (~1162 lines). There are no components, no framework, and no state manager — just PixiJS 8 + vanilla ES6 with imperative state.

**Tech stack:** PixiJS 8 (GPU-accelerated 2D rendering) + Vite (bundler). No React/Vue.

**PixiJS docs:** https://pixijs.com/8.x/guides/getting-started/intro — consult this for any PixiJS API changes or new features before making updates to rendering, containers, filters, or textures.

### PixiJS Container Hierarchy

```
Stage
├── bgSprite                  (full-screen background)
└── root                      (centered game machine)
    └── machine
        ├── panelSprite       (reel panel background)
        ├── reelsViewport     (masked to 5×3 visible grid)
        │   ├── reelArea      (5 reel columns, each with 11 symbol cells)
        │   ├── reelOverlaySprite
        │   ├── dimOverlay    (dims reels on win)
        │   └── highlightLayer → winLayer (glow boxes, connecting lines, payout text)
        └── hud               (spin button, bet +/−, credit/bet labels, icons)
```

### State

All state is top-level module-level variables: `isSpinning`, `credit`, `bet`, `turboHeld`, `allowWrapRandomize`. Reel state is an array of 5 objects holding `position`, `symbols`, `resultIds`, and `tween`.

### Spin Flow

1. `spin()` is called → deducts bet, tweens all 5 reels to random final positions
2. Each reel eases to stop with `easeOutCubic`; normal mode 900–1400ms staggered, turbo 240–380ms
3. After all reels stop: `checkWin()` reads `resultIds` from the visible grid
4. `showWinVisuals()` draws glowing cell highlights, connecting lines, payout text
5. `startWinPulse()` pulses the win layer; `showDimOverlayAndPause()` dims for 1500ms (300ms turbo)
6. Win visuals persist until the next spin begins

### Win Logic (in `checkWin()`)

- **5-of-a-kind horizontal:** All 5 symbols in a row match → 5.0× bet
- **3+ consecutive horizontal:** Any 3+ matching from left in a row → 2.5× bet
- **Diagonals:** 3-in-a-row down-right or up-right → 2.5× bet each
- Multiple patterns accumulate; overlapping cells are highlighted once

### Reel Wrapping

Each reel has 11 symbol cells (3 visible + 8 hidden). `updateReelSymbols()` recycles cells as `position` increases, randomizing new symbols on wrap. A `BlurFilter` is applied during spin with strength proportional to velocity.

### Layout

`layout()` runs on every resize. It centers the machine, right-aligns HUD buttons, left-aligns credit/bet info, and clamps DPR to 1–2× for font scaling.

### Sound

Each sound (`clickSpin`, `fallIcons`, `threeLines`, `fiveLines`) has 2–3 cloned Audio objects to allow polyphonic playback.

### Turbo Mode

Hold `SPACE` → `turboHeld = true` → spin times 4× faster, pause durations shorter, "TURBO" label shown above spin button. Continuous spins loop automatically while held.

### Assets

- `src/assets/1.png` … `15.png` — symbol textures (15 symbols)
- `src/assets/bg.png`, `canvas.png`, `overlay.png` — background and reel panel
- `src/assets/*.mp3` — sound effects
- `src/counter.js` — unused Vite template artifact, ignore it
