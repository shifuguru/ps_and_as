# 🎮 Ps and As – Presidents & Arseholes / Scum (React Native + Node)

Fast, pass-and-play card game with optional server rules engine. Built with Expo (client) and Node (server).
This is a cross-platform card game built with **Expo (React Native)**.  
Currently under active development — the repository will be opened for public testing once the rules and online connectivity are stable.

## Features
- Pass-and-play with hand management, turns, and **runs** rules.
- Rules engine with unit tests.
- Offline first; optional server sync.

## Quick start
## Rules (Ps & As)
See [`/docs/rules.md`](./docs/rules.md) for full spec including **runs** logic, passing, ranking, and special cards.

## Tech
React Native (Expo), TypeScript, Zustand, Node 20, Vitest/Jest, ESLint+Prettier, GitHub Actions.

## Roadmap
- [ ] Full runs/bombs test coverage
- [ ] Local Bluetooth / LAN
- [ ] Simple bot AI
- [ ] E2E tests (Detox)

## Licence
MIT (see `LICENSE`). Placeholder assets © their owners.

---

## 🚀 Getting Started

### 1. Prerequisites

Before running the project, make sure you have the following installed:

- **[Node.js](https://nodejs.org/en)**  
  (LTS version recommended)

- **npm**  
  (comes with Node.js)

- **[Expo CLI](https://docs.expo.dev/more/expo-cli/)**  
  ```bash
  npm install -g expo-cli
  ```

---

### 2. Download the Project

You can clone this repository using **GitHub Desktop**:

1. Open **GitHub Desktop**  
2. Click **File → Clone Repository...**  
3. Paste the repository URL (once available publicly)  
4. Choose a local folder and click **Clone**

Or via command line:

```bash
git clone https://github.com/yourusername/presidents-and-arseholes.git
cd presidents-and-arseholes
```

---

### 3. Install Dependencies

Open **PowerShell** (or your preferred terminal) in the project folder and run:

```bash
npm install
```

This installs all required packages listed in `package.json`.

---

### 4. Run the Project

To start the development server, run:

```bash
npx expo start
```

This will open the **Expo Developer Tools** in your browser.  
You can then:

- Press **“Run on Android device/emulator”**  
- Press **“Run on iOS simulator”**  
- Or scan the QR code with the **Expo Go** app (on your physical phone)

---

### 5. Troubleshooting

If Expo fails to start or dependencies are missing, try the following:

```bash
npm install -g expo-cli
npm install
npx expo start -c
```

> `-c` clears the Expo cache.

---

### 6. Notes

- The project is currently **private** and in **testing phase**.  
- Multiplayer and rule logic are still being refined.  
- Public testers will be invited once stability is confirmed.

---
