# Star Assault — Space Shooter

A browser-based space shooter game built with vanilla JavaScript and the HTML5 Canvas API. No external dependencies or build tools required.

## Demo

**[Play Live on GitHub Pages](https://mesmatmm.github.io/Space-Shooter/)**

Or open `index.html` in any modern browser to play locally.

## Gameplay

Defend the galaxy from endless waves of enemy ships across escalating difficulty levels.

### Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Move left | `←` or `A` | Drag left |
| Move right | `→` or `D` | Drag right |
| Shoot | `Space`, `↑`, or `W` | Tap |
| Start / Retry | `Enter` | Button |
| Back to menu | `Escape` | Button |

### Enemy Types

| Enemy | HP | Points | Notes |
|-------|----|--------|-------|
| Scout | 1 | 10 | Fast, common |
| Fighter | 2 | 25 | Appears from Level 2 |
| Bomber | 4 | 60 | Appears from Level 4, slow but tough |

### Power-ups

| Icon | Effect | Duration |
|------|--------|----------|
| ♥ | +1 Life (max 5) | Instant |
| ⚡ | Rapid Fire | 5 seconds |
| 🛡 | Shield (absorbs one hit) | 6 seconds |

Power-ups spawn every 600 frames and fall from the top of the screen.

### Leveling

Score thresholds for each level:

| Level | Score Required |
|-------|---------------|
| 2 | 100 |
| 3 | 250 |
| 4 | 500 |
| 5 | 900 |
| 6 | 1400 |
| 7 | 2100 |
| 8 | 3000 |

Higher levels increase enemy speed, spawn rate, enemy bullet speed, and unlock tougher enemy types.

## Features

- Parallax star field with 3 depth layers
- Procedurally drawn player and enemy ships (no image assets)
- Particle explosion effects
- Web Audio API sound effects and generative ambient music (no audio files needed)
- Floating score text on kills
- Shield and rapid-fire power-up timers displayed as canvas bars
- High score saved to `localStorage`
- Touch / mobile support
- `roundRect` canvas polyfill for older browsers

## Project Structure

```
space-shooter/
├── index.html   # Game shell, HUD markup, and screen overlays
├── style.css    # Layout, overlay styles, buttons, and animations
└── game.js      # All game logic: engine, entities, input, audio
```

## Browser Support

Any modern browser with Canvas and Web Audio API support (Chrome, Firefox, Safari, Edge). No installation or build step required.
