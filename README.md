# Presidents & Assholes (Ps & As)

> *A respectable card game for deeply disrespectful people.*

Welcome.

If you've landed on this page unexpectedly, one of three things has probably happened:

* the game is loading,
* the game is updating,
* or the game has briefly fallen down a flight of stairs.

In most cases, simply refreshing fixes everything.

If not, remain calm. The cards are being aggressively reorganised behind the scenes.

---

# Contents

* [What Is Ps & As?](#what-is-ps--as)
* [How To Play](#how-to-play)

  * [Objective](#objective)
  * [Turn Structure](#turn-structure)
  * [Card Rankings](#card-rankings)
  * [Special Rules](#special-rules)
  * [Runs](#runs)
  * [Round Start Rules](#round-start-rules)
  * [President & Asshole Trades](#president--asshole-trades)
* [Game Modes](#game-modes)
* [Controls](#controls)
* [Troubleshooting](#troubleshooting)
* [Development Status](#development-status)
* [Developer Notes](#developer-notes)

---

# What Is Ps & As?

**Presidents & Assholes** is a multiplayer climbing card game built with:

* Expo
* React Native
* TypeScript
* Socket.IO multiplayer

Play locally against CPU players, pass the device around with friends, or play online in live multiplayer rooms.

The game includes:

* Solo Quick Game
* Online multiplayer lobbies
* Animated dealing and table presentation
* Runs
* Jokers
* 2-clears
* Four-of-a-kind challenges
* Dead-hand rules
* President / Asshole ranking system
* Cross-platform mobile + web support

---

# How To Play

## Objective

Get rid of all your cards before everyone else.

The first player out becomes the **President**.

The last player holding cards becomes the **Asshole**.

This is considered a great honour for one player and an absolutely devastating public humiliation for the other.

---

## Turn Structure

Players take turns playing:

* a single card,
* a pair,
* triples,
* quads,
* or valid runs.

Each play must beat the previous play on the table.

If you cannot play, you must pass.

When everybody else passes, the pile clears and the last successful player starts a new trick.

---

## Card Rankings

Lowest to highest:

| Rank  |
| ----- |
| 3     |
| 4     |
| 5     |
| 6     |
| 7     |
| 8     |
| 9     |
| 10    |
| J     |
| Q     |
| K     |
| A     |
| 2     |
| Joker |

Yes, 2s are powerful.

No, this is not negotiable.

---

## Special Rules

### 2s

Playing a 2 instantly clears the pile.

The player who used the 2 immediately starts the next trick.

---

### Jokers

A Joker can beat any non-empty pile.

Use responsibly.

Or irresponsibly. Both are valid.

---

### Four Of A Kind

Playing four of a kind creates a challenge.

The next player must beat it with:

* a higher four of a kind,
* or a Joker.

Otherwise they pass.

---

### 10 Rule

After playing 10s, the player chooses whether the trick continues:

* upward,
* or downward.

This rule exists primarily to create chaos.

---

## Runs

Runs are sequences of consecutive ranks.

Examples:

* 4-5-6
* 9-10-J-Q
* pair runs like 7-7 / 8-8 / 9-9

Runs must:

* contain at least 3 ranks,
* stay consecutive,
* and maintain equal multiplicity.

---

## Round Start Rules

Round 1 must begin with:

* the **3♣**

However:

If the dead hand contains the 3♣, the opening card becomes:

* the **3♠**

As all sensible legal systems intended.

---

## President & Asshole Trades

After the first round:

* the President gives away their worst cards,
* the Asshole gives away their best cards.

The rich get richer.

The poor become strategically interesting.

---

# Game Modes

## Quick Game

Jump directly into a match against CPU opponents.

Fast setup. No networking required.

---

## Online Multiplayer

Create or join live rooms with Socket.IO multiplayer.

Features include:

* reconnect grace periods,
* spectator support,
* live state synchronisation,
* and mid-game rejoining.

---

# Controls

## Mobile

* Tap cards to select
* Tap again to deselect
* Use Play or Pass to confirm actions

---

## Web

* Click cards to select
* ESC closes overlays
* Mouse wheel supported in menus

---

# Troubleshooting

## The game froze

Refresh the page first.

If the issue continues:

* the server may be restarting,
* a deployment may be in progress,
* or reality itself may be unstable.

---

## Multiplayer disconnected

The server attempts to preserve your seat briefly after disconnects.

Rejoining usually restores the match automatically.

---

## The UI exploded

This is referred to internally as:

> “a visual event.”

Please refresh.

---

# Development Status

Ps & As is actively in development.

Current work includes:

* UI improvements
* mobile optimisation
* multiplayer polish
* animation refinement
* progression systems
* additional table customisation

Things may occasionally:

* break,
* flicker,
* duplicate themselves,
* or develop opinions.

This is normal during construction.

---

# Developer Notes

## Stack

* Expo SDK 54
* React Native 0.81
* TypeScript
* Socket.IO

---

## Local Development

```powershell
npm install
npm start
npm run web
```

---

## Multiplayer Server

```powershell
npm run server
```

Default:
`http://localhost:3000`

Production endpoint:
`EXPO_PUBLIC_SERVER_URL`

---

## Tests

```powershell
npm run test-core
npm run test-runs
npm run test-multiplayer
```

---

## Project Structure

```text
App.tsx
src/
  game/
  screens/
  components/
  utils/
server/
scripts/
```

---

# Repository Status

Currently private.

Public release preparation is ongoing, including:

* licensing,
* asset replacement,
* deployment hardening,
* and reducing the number of deeply concerning comments in the codebase.
