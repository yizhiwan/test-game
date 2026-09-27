# test-game

A collection of browser games. Each game lives in its own folder under
[`games/`](games) with its own dependencies, Dockerfile and README, so they
build and deploy independently.

| Game | Description | Folder |
|---|---|---|
| **Cyberpunk Lab 404** | AI-driven murder mystery escape room: four LLM-powered suspects, sixty minutes of air. | [`games/cyberpunk-lab-404`](games/cyberpunk-lab-404) |
| **Abyss Station** | Among Us-style multiplayer social deduction on a deep-sea research base, with AI bot players. | [`games/abyss-station`](games/abyss-station) |

## Running a game

```bash
cd games/cyberpunk-lab-404
npm install
npm run dev
```

Or from the repo root: `npm run install:all` then `npm run dev:lab404`.

## Adding a game

Create `games/<name>/` with its own `package.json`, and add `dev:<name>` /
`build:<name>` scripts to the root `package.json`.
