# VIBE SLOT

A neon-drenched, free-to-play 3D slot experience built with [Three.js](https://threejs.org/) and Vite.

公開版: [https://kazumakikuzawa.github.io/vibeslot/](https://kazumakikuzawa.github.io/vibeslot/)

## Features

- A 4 × 5 symbol matrix with 13 horizontal, vertical, and diagonal paylines
- Animated win-line overlays plus payout-scaled coin rain that finishes within two seconds
- Bloom, particles, dynamic lighting, camera shake, and jackpot celebration effects
- Synthesized reel sounds, metallic coin chimes, and an EDM loop via Web Audio
- Responsive keyboard, mouse, and touch controls
- Fully local fictional credits — no purchases, cash value, accounts, or backend
- Deterministic unit tests for payout logic

## Run locally

```bash
npm install
npm run dev
```

Then open the URL shown by Vite. Press **SPIN** or the **Space** key to play.

## Validation

```bash
npm test
npm run build
```

## License

MIT
