# Playwright layer (optional)

Not required for `npm run test-release-gate`. Use when changing Quick Game navigation, `MockAdapter`, or `GameScreen` input handling.

```bash
npm i -D @playwright/test
npx playwright install chromium
npx playwright test scripts/release-gate/playwright/
```

Scope: gameplay smoke only (phase transitions, one legal action). No screenshot or layout assertions.
