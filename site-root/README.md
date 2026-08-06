# Site root (shifuguru.github.io)

Files here are the **domain root** landing page for [https://shifuguru.github.io/](https://shifuguru.github.io/).

They live in this game repo so they stay in sync with rules and privacy links. Deploy them to the separate [**shifuguru.github.io**](https://github.com/shifuguru/shifuguru.github.io) user-site repository.

## AdSense: root domain only

Google AdSense approves **`shifuguru.github.io`** (the root domain), not a path like `/ps_and_as/`.
You cannot register the game subdirectory as its own site.

| URL | Role |
|-----|------|
| `https://shifuguru.github.io/` | AdSense site URL — must have **substantive content**, **no ad scripts** |
| `https://shifuguru.github.io/ps_and_as/` | Playable game — interstitials, rewarded, banner **after** domain is approved |
| `https://shifuguru.github.io/ads.txt` | Required at domain root for all ad serving |

Once the **root domain** passes review, in-game ads on `/ps_and_as/` are covered by the same
AdSense account. Do not load `adsbygoogle.js` on the homepage — that was the original rejection.

## Why this exists

Google AdSense rejected the root URL for **“Google-served ads on screens without publisher content”**. The old homepage was a one-line blurb **with** `adsbygoogle.js` loaded — a navigation-only page with ads.

**Policy fix:**

1. **No ad scripts on the root** — only the `google-adsense-account` meta tag (for account linking) and `ads.txt`.
2. **Substantive publisher content** on the homepage (about, rules summary, FAQ, links).
3. **Monetize inside the game** at `/ps_and_as/` only (interstitials, rewarded, optional banner).

## Deploy to GitHub Pages user site

### Option A — one command (recommended)

From this repo, with [GitHub CLI](https://cli.github.com/) logged in as **your** GitHub account (not the bot):

```bash
./scripts/deploy-site-root.sh
```

Or paste in the browser: [edit index.html on shifuguru.github.io](https://github.com/shifuguru/shifuguru.github.io/edit/main/index.html) — replace all content with `site-root/index.html` from this repo, and **remove** the `adsbygoogle.js` script if present.

### Option B — GitHub Actions (automatic)

Add repository secret **`USER_SITE_DEPLOY_TOKEN`** on `ps_and_as` (fine-grained PAT with **Contents: read/write** on `shifuguru/shifuguru.github.io`). Pushes to `main` that touch `site-root/` trigger [Deploy site root](../../.github/workflows/deploy-site-root.yml).

### Option C — manual copy

```bash
cp site-root/index.html /path/to/shifuguru.github.io/index.html
cp site-root/ads.txt   /path/to/shifuguru.github.io/ads.txt
cd /path/to/shifuguru.github.io
git add index.html ads.txt
git commit -m "AdSense: rich landing page, remove ads from homepage"
git push origin main
```

After push, confirm:

- https://shifuguru.github.io/ shows the full landing page
- View source: **no** `pagead2.googlesyndication.com` script on the homepage
- https://shifuguru.github.io/ads.txt is still correct
- https://shifuguru.github.io/ps_and_as/ still loads the game (unchanged)

## AdSense re-review

1. Fix and deploy the root site (above).
2. In [AdSense → Sites](https://www.google.com/adsense/), open **shifuguru.github.io**.
3. Choose **Request review** (or fix violations → submit).
4. In the note, explain:
   - Root is an informational landing page with **no ads**.
   - Interactive game content and ad placements are at `/ps_and_as/` only.
   - `ads.txt` is published at the domain root.

Review can take a few days. Until approval, H5 interstitial/rewarded ads may not fill even in the game.

## Editing

When rules or links change, update `site-root/index.html` here, then copy to `shifuguru.github.io` again.
