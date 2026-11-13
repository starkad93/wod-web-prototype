# Wings of Destiny — independent browser prototype

An original fantasy browser-RPG prototype built with Phaser 3, TypeScript, Vite, and EasyStar.js. It uses only programmatically drawn placeholder art; it contains no copied game code or assets.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Verify a production bundle with `npm run build`.

## Playable slice

- Explore an original safe plaza with click-to-move pathfinding.
- Talk to the Guard Captain, then the Guild Admin.
- Defeat two creatures and challenge the Shadow Warden.
- Use **Magic Blast** (click target or Space) and **Arcane Burst** (button or `2`). Both spend mana; mana regenerates over time. Stay close to enemies to avoid their attacks.
- Gain XP and levels. Level-ups increase maximum HP/MP and restore them.
- Story progress, defeated enemies, XP, and level are saved in browser local storage.

The combat and progression values are prototype tuning, not claims about the original game's exact formulas. This is a single-player slice, not a complete MMO: there is no server, PvP, guild networking, full equipment economy, or original game art.
