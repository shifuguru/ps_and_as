# Ops: persistence & backups

Addresses the Railway `player-stats.json` durability gap called out in [ARCHITECTURE_GAPS.md](../ARCHITECTURE_GAPS.md) (XP persistence).

## Current store

- Path: `server/data/player-stats.json` (see `server/playerStatsStore.js`)
- Format: JSON map of playerId → `{ stats, profile?, updatedAt }`
- Atomic write: write `.tmp` then rename

Without a persistent volume, **redeploys can wipe cloud XP**.

## Required operator setup (Railway)

1. Create a volume on the production Railway service.
2. Mount it at the directory that contains `player-stats.json`.
   - App working directory is typically `/app` with `startCommand = npm run start:server`.
   - Mount destination should be **`/app/server/data`** so `DATA_FILE` resolves on the volume.
3. Confirm after deploy: file still present across a no-op redeploy.
4. Set `GOOGLE_SESSION_SECRET` to a dedicated random value (not the public client ID).

Railway’s dashboard is the source of truth for volume attachment; keep this doc in sync when the mount path changes.

## Backups

Use [scripts/backup-player-stats.js](../scripts/backup-player-stats.js):

```bash
# Local / CI with file access:
node scripts/backup-player-stats.js --file server/data/player-stats.json --out-dir ./backups

# On Railway shell (example):
node scripts/backup-player-stats.js --file server/data/player-stats.json --out-dir /app/server/data/backups
```

Recommended cadence: **weekly** copy off-box (download backup artifact to secure storage), and always before bulk migrations or secret-related data surgery.

## Restore

1. Stop or quiesce writes if possible.
2. Replace `player-stats.json` with the backup (keep a copy of the broken file).
3. Restart the service.
4. Spot-check a known `google:…` id via `GET /api/player-stats/:playerId`.

## Deletion

Verified player requests: [scripts/delete-player-stats.js](../scripts/delete-player-stats.js) — see [SECURITY.md](../SECURITY.md).

## Future (Phase B+)

A managed database (Postgres, etc.) remains optional until scale or SOC 2 Availability commitments require it. Volume + backups are the minimum durability control for the current JSON store.
