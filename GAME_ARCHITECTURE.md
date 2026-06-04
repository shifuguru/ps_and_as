# Game UI & match architecture

Player-facing states and component ownership for Presidents & Arseholes. Use this when tracking UI bugs, adding features, or onboarding developers.

For server sync, dead hand, and bot tables see [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md).

---

## 1. App ownership (reference diagram)

```
App
├─ Main Menu                    (src/screens/MainMenu.tsx)
├─ Find Game                    (src/screens/FindGame.tsx)
├─ Create Game                  (src/screens/CreateGame.tsx — host + join lobby)
├─ Lobby                        (inside Create Game — ready, seats, start)
└─ Game Screen                  (src/screens/GameScreen.tsx — persistent for the match)
    ├─ Opponent Ring            (src/components/OpponentRing.tsx via GamePlayArea)
    ├─ Centre Play Area         (src/components/GameTable.tsx + play flights in GamePlayArea)
    ├─ Player Hand              (src/components/PlayerHand.tsx)
    ├─ Bottom Bar               (src/components/BottomBar.tsx — hand + ActionBar)
    ├─ Primary Overlay          (deal, trade, last hand, rankings+ready, 10-rule)
    └─ Secondary Overlay        (leave confirm, player profile, settings/achievements from App)
```

**Navigation (`App.tsx`):** Menu → Find or Create → Lobby → **Start / spectate** → Game Screen. Leaving the match unmounts Game Screen and returns to menu (or Find).

---

## 2. Match lifecycle (player-facing)

```mermaid
flowchart TD
  MM[Main Menu]
  FC[Find Game or Create Game]
  LB[Lobby — ready, seats, start]
  SH[Game Shell — same screen for whole match]

  MM --> FC --> LB
  LB -->|Start / spectate| SH

  SH --> DEAL[Deal phase overlay]
  DEAL --> TRADE{Role trades required?}
  TRADE -->|Yes| RTP[Role trade overlay]
  TRADE -->|No| PLAY
  RTP --> PLAY[Round gameplay loop]

  PLAY --> PLAY
  PLAY -->|Last player out| RC[Round complete]
  RC --> LH[Last hand review overlay]
  LH --> RK[Final rankings + ready — one overlay]
  RK -->|Everyone ready| DEAL

  SH -->|Leave| MM
  LB -->|Back| MM
```

**Round gameplay loop (inside the box):** turns → play/pass → trick resolves (table pause, winner banner) → players go out → repeat until round complete.

**Known ordering issue (online):** Final rankings can flash before last hand if `gameStateSync` marks the round complete before `roundEnded` delivers `lastPlayerHand`. Intended order is always last hand → rankings.

---

## 3. Game Shell hierarchy

The shell stays mounted; **one primary overlay** (plus optional secondary modals) sits above the table.

```mermaid
flowchart TB
  subgraph shell["Game Shell — GameScreen + ScreenContainer + felt"]
    HUD[HUD — Header, room notice, ceremony status, fab buttons]
    subgraph table["Table region — GamePlayArea"]
      RING[Opponent Ring — seats, avatars, turn bell, nudge highlight]
      subgraph centre["Centre Play Area — GameTable + flights"]
        PILE[Active pile]
        HIST[Play history / card flights / stack collect]
        TURN[Turn indicator — Your turn / Waiting for…]
        PILLS[Play-type pills — Runs, Rank closed, etc.]
        BANNER[Trick winner banner + shout]
        CTX[Context prompts — e.g. dealer reshuffle hint]
      end
    end
    HAND[Player Hand — PlayerHand]
    BAR[Bottom Bar — Play / Pass / Leave, ActionBar]
    subgraph primary["Primary overlay — one at a time"]
      P0[None — live play]
      P1[Deal — DealCeremonyOverlay]
      P2[Trade — RoleTradeModal / strip]
      P3[10-rule — TenRuleModal]
      P4[Last hand — LastHandRevealOverlay]
      P5[Rankings + ready — RoundCompleteModal]
    end
    subgraph secondary["Secondary overlay"]
      S1[Leave confirm]
      S2[Player profile — LobbyPlayerModal]
    end
  end

  HUD --- table
  table --- HAND
  HAND --- BAR
  primary -.->|covers| centre
  primary -.->|covers| HAND
```

**Centre Play Area bugs** (pills shifting with empty pile, pills behind avatars) are localized to `GameTable.tsx` layout and z-order vs `OpponentRing` — not the hand or bottom bar.

| Centre sub-area | Main code |
|-----------------|-----------|
| Active pile | `GameTable` pile / stacks |
| Play history / animations | `GamePlayArea` flights, `TableCardFlight`, trick pause snapshot |
| Turn indicator | `GameTable` turn hint pill (`formatWaitingForTurnHint`) |
| Play-type pills | `GameTable` play-type badge row |
| Trick winner banner | `GameTable` winner overlay; driven from `GameScreen` trick pause |
| Context prompts | Reshuffle overlay, ceremony status pill, away banner |

---

## 4. Overlay & gameplay state machine

```mermaid
stateDiagram-v2
  [*] --> DealOverlay: New round

  DealOverlay --> TradeOverlay: Trades required
  DealOverlay --> Gameplay: No trades / ceremony finished
  TradeOverlay --> Gameplay: Trades complete

  state Gameplay {
    [*] --> TurnPlay
    TurnPlay --> TrickPause: Trick won
    TrickPause --> TurnPlay: Pause ends (~1.7s)
    TurnPlay --> TenRule: 10 played
    TenRule --> TurnPlay: Direction chosen
    TurnPlay --> WaitingForServer: Online intent sent
    WaitingForServer --> TurnPlay: gameStateSync applied
    WaitingForServer --> TurnPlay: Error / reject
  }

  Gameplay --> LastHand: Round complete
  LastHand --> RankingsReady: Dismiss or 4s timer
  RankingsReady --> DealOverlay: Ready → next round

  RankingsReady --> [*]: Leave match
  Gameplay --> [*]: Leave match
```

### WaitingForServer (online only)

Players do not see a separate screen. It is implemented when:

- `actionPending` is true after Play/Pass until the next authoritative snapshot, and/or
- `readOnlyGame` blocks input during that window.

That separates **“I tapped Play”** from **“the server accepted it and the table moved.”** Most multiplayer desync bugs involve acting during or after this gap without treating it as its own phase.

| Player action | Client | Server |
|---------------|--------|--------|
| Play / Pass | `gameAction` only; no local `playCards` | Validates → `playCards` / `passTurn` → `gameStateSync` |
| Ready (next round) | `playerReadyForNextRound` | `tryStartNextRoundIfReady` → `nextRoundStarting` + new deal |

### Primary overlay visibility (GameScreen)

| Overlay | Rough condition |
|---------|----------------|
| Deal | `ceremonyPrep` set |
| Trade | `tradePhase` + active trade |
| 10-rule | `tenRulePending` + human chooser |
| Last hand | `lastHandReveal` |
| Rankings + ready | `roundOver && !lastHandReveal && !ceremonyPrep && !tradePhase` |
| None | Otherwise (gameplay or WaitingForServer) |

---

## 5. Primary vs secondary overlays

| Layer | Components | Purpose |
|-------|------------|---------|
| **Primary** | `DealCeremonyOverlay`, `RoleTradeModal`, `LastHandRevealOverlay`, `RoundCompleteModal`, `TenRuleModal` | Block table until phase completes |
| **Secondary** | `LeaveGameConfirmModal`, `LobbyPlayerModal` | Confirmations / inspect player without ending the match |

Rankings and **Ready for next round** share **`RoundCompleteModal`** — there is no separate Ready overlay.

---

## 6. Related docs

- [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md) — server authority, `stateVersion`, dead hand, bot loop
- [QA_BOT_LEAGUE.md](./QA_BOT_LEAGUE.md) — **QA League** easter egg + autonomous harness (`npm run qa-league` → `reports/qa/latest/AGENT_BRIEF.md` for agent iteration)
- `src/screens/updateLogContent.ts` — player-facing release notes
