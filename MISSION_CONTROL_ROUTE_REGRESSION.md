# P1 Investigation — Mission Control Route Regression

**Date:** 2026-06-08  
**Scope:** Evidence only — no fixes applied  
**Observed URL:** `/ps_and_as/mission_control`  
**Canonical URL (design):** `/ps_and_as/mission-control`

---

## Executive summary

Mission Control **never shipped on `main`**. The route gate in `App.tsx` was implemented in a local session but **was never committed**. The wiring currently lives in **`git stash@{0}` (`temp-audit`, 2026-06-20 20:52 NZST)** while the working tree’s `App.tsx` matches **`HEAD` (`249eabb`)** with **no Mission Control imports or branch**.

The reported behaviour — app opens, splash completes, **Main Menu** appears — is the **default `AppContent` boot path**. That is expected when:

1. **`App.tsx` has no `isMissionControlRoute()` early return** (current state), and/or  
2. The URL uses **`mission_control` (underscore)** instead of **`mission-control` (hyphen)** — the only pattern `isMissionControlRoute()` checks.

This is **not a regression from a deployed commit**. Production v1.0.60 @ `249eabb` has never contained Mission Control routing. The “regression” is **loss of uncommitted local wiring** (stash + HEAD restore), compounded by a **URL naming mismatch**.

---

## Direct answers

| Question | Answer |
|----------|--------|
| **Is the route being matched?** | **No.** `isMissionControlRoute()` is never called from committed `App.tsx`. Even if it were, `/mission_control` would not match `path.includes("/mission-control")`. |
| **Is the route being redirected?** | **Yes (GitHub Pages).** Committed `404.html` always `location.replace`s to `/ps_and_as/` (+ query only), **dropping the deep path**. On local Expo dev, no redirect — but default game boot still runs. |
| **Is the route failing validation?** | **N/A — route lookup never runs.** No feature flag or auth guard blocks Mission Control; the gate simply does not exist in the shipped entrypoint. |
| **Is the route missing entirely?** | **Yes — in git and in production.** Screen + loader exist **untracked locally**; `App.tsx` route registration is **missing from `HEAD` and working tree** (present only in stash). |

---

## Pipeline table

| Stage | Expected | Actual (HEAD + working tree, 2026-06-08) |
|-------|----------|------------------------------------------|
| **URL parse** | Browser pathname `/ps_and_as/mission-control` (hyphen); optional GH Pages 404 preserves path | User URL `/ps_and_as/mission_control` (underscore) — **no code references `mission_control` anywhere in repo**. GH Pages `404.html` **strips any deep path** → `/ps_and_as/`. |
| **Route lookup** | `App.tsx` calls `isMissionControlRoute()` before `AppContent` | **No call.** `App.tsx` has zero matches for `MissionControl`, `mission-control`, or `isMissionControlRoute`. |
| **Screen registration** | `MissionControlScreen` imported; early return renders MC portal | **Not registered.** `MissionControlScreen.tsx` and `src/studio/loadStudioData.ts` are **untracked (`??`)**. Not in any commit (`git log -S "MissionControlScreen"` → empty). |
| **Navigation** | Skip splash/menu/game boot; render `<MissionControlScreen />` inside `ThemeProvider` | **`AppContent` always runs:** `splashVisible` → splash animation → `setMenuVisible(true)` → Main Menu. No pathname-based screen switch. |
| **Render** | Mission Control dashboard after `loadStudioData()` | **Never reached.** User sees standard felt wallpaper + Main Menu after splash. |

---

## Complete routing path (as implemented vs as shipped)

### Shipped path (production + current working tree)

```
Browser URL
  └─ GitHub Pages: unknown path → 404.html
       └─ fetchVersion OK → toApp() → location.replace("/ps_and_as/" + search)
            └─ index.html loads SPA bundle (no MC code in bundle)
                 └─ index.ts → registerRootComponent(App)
                      └─ App.tsx (HEAD)
                           └─ useAppFonts → AppErrorBoundary → AppContent
                                └─ SplashScreen → MainMenu
```

**Evidence — `404.html` path strip:**

```49:51:404.html
        function toApp() {
          var qs = location.search || "";
          location.replace(appRoot + qs);
```

**Evidence — `App.tsx` entry (no MC branch):**

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

### Intended path (local Phase 1 — present in stash only)

From `git stash show -p stash@{0}` (message: `temp-audit`, 2026-06-20 20:52:53 +1200):

```
Browser URL /ps_and_as/mission-control
  └─ (404.html in stash preserves /mission-control — not in committed 404.html)
       └─ App.tsx
            └─ missionControl = Platform.OS === "web" && isMissionControlRoute()
                 └─ true → ThemeProvider → MissionControlScreen
                 └─ false → AppContent (game)
```

**Evidence — route matcher (untracked file, never called from HEAD `App.tsx`):**

```148:151:src/studio/loadStudioData.ts
export function isMissionControlRoute(): boolean {
  if (Platform.OS !== "web") return false;
  const path = (globalThis as { location?: { pathname?: string } }).location?.pathname ?? "";
  return path.includes("/mission-control");
}
```

**Stash contains the lost `App.tsx` wiring** (imports + early return):

- `import MissionControlScreen from "./src/screens/MissionControlScreen";`
- `import { isMissionControlRoute } from "./src/studio/loadStudioData";`
- `const missionControl = Platform.OS === "web" && isMissionControlRoute();`
- Early return rendering `<MissionControlScreen />` when true

---

## Verification checklist

### 1. Route registration in `App.tsx`

| | |
|--|--|
| **Expected** | URL-gated early return before `AppContent` |
| **Actual** | **Missing.** `grep MissionControl\|mission-control\|isMissionControl App.tsx` → no matches |
| **HEAD commit** | `249eabb` — same (never had MC) |
| **Stash** | `stash@{0}` contains full MC registration |

### 2. Route parsing

| | |
|--|--|
| **Mechanism** | No React Navigation / Expo Router. Parsing is a **string check** on `location.pathname` in `isMissionControlRoute()`. |
| **Pattern** | Substring `/mission-control` only |
| **User URL** | `/ps_and_as/mission_control` — **would fail parse even with wiring** |
| **Repo search** | `grep mission_control` → **0 files** |

### 3. Deep-link configuration

| | |
|--|--|
| **`app.json`** | `experiments.baseUrl: "/ps_and_as"` — asset/base prefix only; **no route table** |
| **`index.ts`** | Registers `App` only; no linking setup |
| **`Linking.getInitialURL`** | Not used for screen routing |
| **GitHub Pages** | Committed `404.html` / `scripts/pages-404.html` redirect deep links to app root (path lost) |
| **Stash `404.html`** | Adds preservation: if path contains `/mission-control`, replace to `base + "/mission-control" + qs` — **not applied to working tree** |

### 4. Route guards

| | |
|--|--|
| **Auth / roles** | None (by design — D-005) |
| **`AppErrorBoundary`** | Wraps `AppContent` only on game path. Committed boundary sends **all web errors** to `ReadmeFallbackRedirect` (explains prior “crash into README” on **game** routes, not MC-specific handling) |
| **Stash `AppErrorBoundary`** | Adds `isMissionControlRoute()` branch → `CrashLandingPage` instead of README redirect |

### 5. Mission Control feature flags

| | |
|--|--|
| **Flags** | **None.** Gate is solely `Platform.OS === "web" && isMissionControlRoute()`. |
| **Studio JSON** | Operational data only; no enable/disable switch |

### 6. Web basename / path handling

| Source | Base / static prefix |
|--------|----------------------|
| `app.json` `experiments.baseUrl` | `/ps_and_as` |
| `scripts/fix-web-build-paths.js` | Injects `window.__PS_AND_AS_BASE__` into deploy HTML |
| `src/utils/staticAssetPaths.ts` (untracked) | Resolves `/studio/...` under deploy base or Metro root |
| **Committed `fix-web-build-paths.js`** | **No `studio/` copy step** (stash adds copy to `web-build/studio/`) |
| **Committed `package.json` `web` script** | No `copy-studio-public.mjs` (stash adds it) |
| **`.github/workflows/deploy-web.yml`** | **No `studio/**` path trigger** (stash adds it) |

Production deploy would lack `web-build/studio/` even if the screen were bundled.

### 7. `mission_control` vs `mission-control` naming

| Location | Convention |
|----------|------------|
| `studio/decisions.md` D-005 | `/mission-control` |
| `studio/README.md` | `…/ps_and_as/mission-control` |
| `isMissionControlRoute()` | `/mission-control` |
| `scripts/review-package-screenshots.mjs` | `mission-control` |
| **User report** | `mission_control` — **unsupported** |

---

## Why it “previously loaded” then failed

Prior local session ([Mission Control Phase 1 transcript](7abfa0e6-c7c1-40a9-a2af-5282fdbb5163)) evidence:

| Phase | Behaviour | Cause |
|-------|-----------|-------|
| **Loaded (spinner)** | “Loading Mission Control…” visible | `App.tsx` had stash-style wiring; `loadStudioData()` ran |
| **Blank wallpaper** | Spinner gone, no UI | Render crash: `ReferenceError: styles is not defined` in `StatCard` / `WorkCard` / `ActivityRow`; MC route **not** in error boundary → empty felt backdrop |
| **README crash** | Redirect to readme-fallback | Later render crashes on schema drift (`release_status.json` shape vs UI expecting `gate.lastRun.failed`); or game-route errors hitting committed `ReadmeFallbackRedirect` |
| **Main Menu now** | No MC at all | **`git stash push -m "temp-audit"`** removed `App.tsx` / `AppErrorBoundary` / `404.html` MC changes from working tree; MC screen files stayed untracked |

---

## Git / deploy state

| Artifact | Status |
|----------|--------|
| `HEAD` | `249eabb` — v1.0.59 commit message; `package.json` says 1.0.60 locally |
| `origin/main` | Same as HEAD (per prior audit) |
| `git log -S "MissionControlScreen"` | **Empty — never committed** |
| `git log -S "isMissionControlRoute"` | **Empty** |
| `git log -S "mission-control"` | **Empty** |
| Untracked MC stack | `src/screens/MissionControlScreen.tsx`, `src/studio/`, `studio/`, `public/studio/`, `scripts/studio/`, `src/utils/staticAssetPaths.ts`, `src/utils/fetchStaticAsset.ts` |
| `App.tsx` vs HEAD | **Identical** (no local diff) |
| `git stash list` | `stash@{0}: On main: temp-audit` (2026-06-20 20:52:53 +1200) — **contains MC App.tsx wiring, 404 preservation, AppErrorBoundary MC branch, studio build pipeline edits** |
| Production bundle | No MC strings in `web-build/` (grep `mission-control\|MissionControl` → none) |

---

## Exact change that caused the regression

**There is no git commit on `main` that removed Mission Control.** The feature was never merged.

The observable regression from “Mission Control route loads” → “Main Menu” is explained by:

1. **Primary:** **`git stash` `temp-audit` (2026-06-20 20:52:53 +1200)** — stashed the only copy of `App.tsx` route registration (and related `404.html`, `AppErrorBoundary`, build scripts). Working tree restored to **`249eabb`** behaviour.
2. **URL mismatch:** User navigates to **`mission_control`**; implementation only recognises **`mission-control`**.
3. **Production deep-link:** Committed **`404.html`** always redirects to **`/ps_and_as/`**, so even the correct hyphen URL would not survive a cold GitHub Pages load without stash’s 404 fix.

To restore locally without implementing fixes: `git stash apply stash@{0}` (or selective restore of `App.tsx`, `404.html`, `AppErrorBoundary.tsx`) **and** use URL `/ps_and_as/mission-control`.

---

## Related files (reference)

| File | Role |
|------|------|
| `App.tsx` | Entry — **missing MC gate (HEAD)** |
| `src/studio/loadStudioData.ts` | `isMissionControlRoute()`, `loadStudioData()` — **untracked** |
| `src/screens/MissionControlScreen.tsx` | Portal UI — **untracked** |
| `404.html`, `scripts/pages-404.html` | GH Pages SPA fallback — **strip path (committed)** |
| `app.json` | Web `baseUrl` only |
| `src/components/AppErrorBoundary.tsx` | Web crash → README (committed); MC-aware branch in **stash only** |
| `studio/decisions.md` D-005 | Canonical `/mission-control` URL |
| `RC_1_0_61_EXCLUDED.md` | Explicitly excludes MC from v1.0.61 RC scope |

---

## Conclusion

| Classification | Detail |
|----------------|--------|
| **Root cause** | Route **missing entirely** from committed/shipped `App.tsx`; local wiring **stashed**, not lost by deploy |
| **Contributing** | URL **`mission_control` vs `mission-control`**; GH Pages **404 path strip** |
| **Not the cause** | Feature flag, route validation guard, or a production commit regression |
| **Fix scope (out of scope for this doc)** | Commit MC stack, restore `App.tsx` gate, align URL (or accept both aliases), apply 404 path preservation, wire build/deploy for `studio/` assets |
