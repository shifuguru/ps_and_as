# Mission Control — Localhost Working-State Regression

**Date:** 2026-06-08  
**Scope:** Localhost only — why Mission Control **used to render** and **now shows Main Menu**  
**Evidence only — no fixes applied**

---

## Executive summary

Mission Control rendered on localhost because **`App.tsx` had a local-only early return** that checked `isMissionControlRoute()` and mounted `<MissionControlScreen />` instead of `<AppContent />`.

**Localhost behaviour changed on 2026-06-20 at 20:52:53 +1200** when an agent session ran:

```bash
git stash push -m "temp-audit" --quiet
# … run On Top tsx audit …
git stash pop --quiet   # stderr suppressed
```

That **`git stash push` immediately reverted `App.tsx` to `HEAD`**, removing the route gate from the working tree. **`git stash pop` did not restore it** — `stash@{0}` still exists, and `App.tsx` today has **zero diff from `HEAD`**.

The screen files (`MissionControlScreen.tsx`, `loadStudioData.ts`) **remain on disk as untracked files**, but Metro never imports them because **`App.tsx` no longer references them**.

This is a **working-tree / stash regression**, not a Metro bug, not an Expo config change, and not a deletion of Mission Control source files.

---

## Direct answers

### 1. When was Mission Control last known to work locally?

| When | Evidence | What worked |
|------|----------|-------------|
| **Phase 1 complete** (session ~2026-06-08; files stamped **2026-06-18 01:46**) | Transcript: “Mission Control Phase 1 is implemented”; `App.tsx` StrReplace added route gate | Route matched; at minimum **“Loading Mission Control…”** spinner |
| **After static-asset fix** (same session, post line 757) | `staticAssetPaths.ts` + `fetchStaticAsset.ts`; simulated load at `/ps_and_as/mission-control` succeeded | JSON fetch path fixed for Metro dev |
| **User report: “Mission Control route loads”** (transcript line 758) | Spinner visible; data no longer failing fetch | **Route + loader confirmed working** |
| **After styles / error-boundary fix** (transcript line 773) | Module-level `StyleSheet`; `App.tsx` wraps MC in `AppErrorBoundary` | **Full dashboard expected working** |
| **Last known good for route gate** | **Before 2026-06-20 20:52:53 +1200** | Any time after Phase 1 wiring until `temp-audit` stash |
| **Broken (Main Menu)** | **From 2026-06-20 20:52:54 +1200 onward** | `App.tsx` LastWriteTime = stash second; file matches `HEAD` with no MC imports |

Intermediate states (route still matched, UI broken — **not** Main Menu):

- Blank felt after load → `styles is not defined` render crash (route gate still active)
- README / crash landing → render crash on schema drift (`releaseStatus.gate.lastRun` shape)

Those are **render bugs on the MC path**, not the localhost regression to Main Menu.

### 2. Which files participated in the routing path?

**Working localhost path (hyphen URL):**

```
http://localhost:8081/ps_and_as/mission-control
  │
  ├─ Metro serves SPA (experiments.baseUrl = /ps_and_as in app.json)
  │
  └─ index.ts → registerRootComponent(App)
       │
       └─ App.tsx  export default function App()
            │
            ├─ const missionControl = Platform.OS === "web" && isMissionControlRoute()
            │     └─ src/studio/loadStudioData.ts
            │           path.includes("/mission-control")  → true
            │
            └─ if (missionControl)  ← ONLY THIS BRANCH RENDERS MC
                 └─ ThemeProvider
                      └─ AppErrorBoundary  (stash version: MC-aware)
                           └─ src/screens/MissionControlScreen.tsx
                                └─ loadStudioData()
                                     └─ src/utils/fetchStaticAsset.ts
                                          └─ src/utils/staticAssetPaths.ts
                                               └─ GET /studio/*.json  (public/studio/ mirror)
```

**Current broken path (same URL):**

```
App.tsx (HEAD — no missionControl branch)
  └─ AppErrorBoundary → AppContent
       └─ SplashScreen → setMenuVisible(true) → MainMenu
```

**Supporting files (not route gate, but required for MC to function):**

| File | Role |
|------|------|
| `public/studio/*` | Dev JSON/MD mirror (exists: `dashboard.json` verified on disk) |
| `scripts/studio/copy-studio-public.mjs` | Populates `public/studio/` from `studio/` |
| `src/studio/types.ts` | Types for dashboard data |
| `package.json` `web` script (stash) | Ran copy-studio before Expo dev |

### 3. File disposition today

| File | Working state | Current state | Disposition |
|------|---------------|---------------|-------------|
| **`App.tsx`** | Modified: MC imports + `missionControl` early return (+22 lines in stash stat) | **Identical to `HEAD` (`249eabb`)** — 0-byte diff | **Stashed** in `stash@{0}`; **reverted** on working tree at stash time |
| **`src/components/AppErrorBoundary.tsx`** | MC route → `CrashLandingPage` instead of README redirect | HEAD: all web errors → `ReadmeFallbackRedirect` | **Stashed**; **reverted** on working tree |
| **`src/screens/MissionControlScreen.tsx`** | Untracked; imported by App | **Still on disk** (LastWrite: 2026-06-18 01:46) | **Untracked — not deleted**; **orphaned** (no importer) |
| **`src/studio/loadStudioData.ts`** | Untracked; `isMissionControlRoute()` | **Still on disk** (LastWrite: 2026-06-18 01:46) | **Untracked — not deleted**; **orphaned** |
| **`src/utils/staticAssetPaths.ts`** | Untracked; static URL resolver | **Still on disk** (`??`) | **Untracked — unchanged** |
| **`src/utils/fetchStaticAsset.ts`** | Untracked; JSON fetch helper | **Still on disk** (`??`) | **Untracked — unchanged** |
| **`public/studio/`** | Copied from `studio/` | **Still on disk** (`??`) | **Untracked — not deleted** |
| **`studio/`** | Source of truth | **Still on disk** (`??`) | **Untracked — not deleted** |
| **`package.json`** | `studio:validate`, copy in `web` script | HEAD: no studio scripts | **Stashed**; **reverted** |
| **`scripts/fix-web-build-paths.js`** | Copies `studio/` → `web-build/studio/` | HEAD: no studio copy block | **Stashed**; **reverted** |
| **`404.html`** | N/A for localhost | HEAD: unchanged | Stash has MC path preserve (production only) |

**Not found:** Cursor local history, `.history/`, or any committed version of `MissionControlScreen.tsx` (`git log -S` → empty).

---

## Exact code that previously caused Mission Control to render

From **`stash@{0}:App.tsx`** (the last known working gate):

```typescript
import MissionControlScreen from "./src/screens/MissionControlScreen";
import { isMissionControlRoute } from "./src/studio/loadStudioData";

export default function App() {
  const { ready: fontsReady } = useAppFonts();
  const missionControl = Platform.OS === "web" && isMissionControlRoute();

  if (missionControl) {
    // … font boot …
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <AppErrorBoundary>
            <MissionControlScreen />
          </AppErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  // … normal game boot → AppContent …
}
```

Route matcher (`src/studio/loadStudioData.ts`, still on disk):

```typescript
export function isMissionControlRoute(): boolean {
  if (Platform.OS !== "web") return false;
  const path = (globalThis as { location?: { pathname?: string } }).location?.pathname ?? "";
  return path.includes("/mission-control");
}
```

**Current `App.tsx` (working tree)** — no imports, no branch, always `AppContent`:

```1035:1056:App.tsx
export default function App() {
  const { ready: fontsReady } = useAppFonts();

  if (!fontsReady) {
    return (
      <SafeAreaProvider>
        <View style={[appStyles.fontBoot, Platform.OS === "web" && appStyles.webFontBoot]} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CardAppearanceProvider>
          <AppErrorBoundary>
            <AppContent />
          </AppErrorBoundary>
        </CardAppearanceProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

---

## Timeline: WORKING → change → CURRENT

```
WORKING STATE
│  Phase 1 session (~2026-06-08; MC files stamped 2026-06-18 01:46)
│  App.tsx modified (uncommitted): isMissionControlRoute() gate
│  MissionControlScreen + loadStudioData created (untracked)
│  URL: http://localhost:8081/ps_and_as/mission-control
│  Result: Mission Control screen (spinner → dashboard after fixes)
│
├─► INTERMEDIATE (route still active — NOT Main Menu regression)
│   • Blank wallpaper: StatCard styles ReferenceError
│   • README crash: release_status schema vs UI; fixed in later session edits
│   App.tsx gate still present during these states
│
▼
CHANGE INTRODUCED — 2026-06-20 20:52:53 +1200
│  Event: git stash push -m "temp-audit"
│  Trigger: On Top production investigation (agent shell command)
│  File: App.tsx (+ 25 other tracked files)
│  Mechanism: stash push writes HEAD version to working tree immediately
│  App.tsx LastWriteTime: 2026-06-20 20:52:54 (+1s)
│  Reason MC stopped: route gate removed from active App.tsx
│
├─► Intended recovery: git stash pop --quiet 2>$null
│   Stash still exists → pop did NOT successfully restore
│   (stderr suppressed; terminal 392260 shows tsx command with no output;
│    stash entry retained with full MC diff)
│
▼
CURRENT STATE (now)
│  App.tsx = HEAD (249eabb) — no MissionControl imports
│  MissionControlScreen.tsx still on disk but never imported
│  Expo --clear rebundles App.tsx without MC branch
│  Same URL → AppContent → SplashScreen → MainMenu
│  Reason MC stopped: orphaned screen files + missing App.tsx gate
```

---

## Git / stash / reflog evidence

| Source | Finding |
|--------|---------|
| **`git stash list`** | `stash@{0}: On main: temp-audit` — **2026-06-20 20:52:53 +1200** |
| **`git stash show --stat stash@{0}`** | `App.tsx \| 22 +` (MC gate); 26 files total, 983 insertions |
| **`git diff HEAD App.tsx`** | **0 characters** — working tree matches HEAD exactly |
| **`git show stash@{0}:App.tsx`** | Contains `MissionControlScreen`, `isMissionControlRoute`, `missionControl` branch |
| **`git reflog`** | No commit removed MC; latest: `249eabb HEAD@{0}: reset: moving to HEAD` |
| **`git log -S "MissionControlScreen"`** | Empty — never committed |
| **File timestamps** | `App.tsx` → 2026-06-20 20:52:54; MC screen → 2026-06-18 01:46 (unchanged since) |
| **Terminal 392260** | Records the exact stash command; started 2026-06-20T08:52:53.675Z; `git stash pop` appended with stderr redirected to `$null` |
| **Local history** | No `.history/` or Cursor backup copies found for `App.tsx` |

---

## Why localhost changed (one paragraph)

Metro and Expo did not change routes. **`App.tsx` lost its uncommitted `missionControl` early return when `git stash push -m "temp-audit"` ran during an unrelated On Top audit.** That single file is the switch between Mission Control and the normal game boot. The screen implementation was never deleted — it is still present as untracked sources — but without the `App.tsx` import and branch, the bundle follows `AppContent` → splash → Main Menu. Recovery requires restoring the stashed `App.tsx` hunk (or re-applying the gate), not rebuilding Mission Control from scratch.

---

## URL note (localhost)

The route matcher only accepts **`/mission-control`** (hyphen). There are **zero** references to `mission_control` (underscore) in the repo.

If the URL truly worked before, it was almost certainly the hyphen form (`/ps_and_as/mission-control`), matching session tests and `studio/README.md`. The underscore path would have failed `isMissionControlRoute()` even in the working state.

---

## Restore pointer (informational — not implemented)

To return localhost to the last known working route gate without reimplementing:

```bash
git stash apply stash@{0} -- App.tsx src/components/AppErrorBoundary.tsx
# or full: git stash apply stash@{0}
```

Then reload `http://localhost:8081/ps_and_as/mission-control` with Expo running.

Untracked MC files are already present; only the **tracked** gate files need restoration from stash.

---

## Related backlog (context only — not in scope)

User-listed follow-ups separate from this investigation:

1. Fix On Top! grant path (gameplay)
2. Fix Mission Control route (developer tooling) — **restore stash gate + commit**
3. Hide BOTOPN (D-010)
