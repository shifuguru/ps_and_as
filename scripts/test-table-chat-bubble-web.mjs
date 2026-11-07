/**
 * Start Expo web before running. PLAYWRIGHT_BROWSER_EXECUTABLE_PATH can select
 * an installed browser.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE_PATH }
    : {}),
});

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(process.env.EXPO_WEB_URL ?? "http://localhost:8081/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => {
    const modules = globalThis.__r?.getModules?.();
    if (!modules) return false;
    const names = [...modules.values()].map((module) => module.verboseName);
    return [
      "node_modules/react/index.js",
      "node_modules/react-dom/client.js",
      "src/components/OpponentSeat.tsx",
      "src/context/ThemeContext.tsx",
    ].every((name) => names.includes(name));
  }, null, { timeout: 60000 });

  await page.evaluate(() => {
    const modules = globalThis.__r.getModules();
    const get = (name) => {
      const entry = [...modules.entries()].find(([, module]) => module.verboseName === name);
      if (!entry) throw new Error(`Missing Metro module: ${name}`);
      return globalThis.__r(entry[0]);
    };
    const React = get("node_modules/react/index.js");
    const { createRoot } = get("node_modules/react-dom/client.js");
    const OpponentSeat = get("src/components/OpponentSeat.tsx").default;
    const { ThemeProvider } = get("src/context/ThemeContext.tsx");
    const { countBadgeCenterInAvatarWrap, dealStackCenterInAvatarWrap } = get("src/utils/seatDimensions.ts");
    globalThis.countBadgeGeometry = { countBadgeCenterInAvatarWrap, dealStackCenterInAvatarWrap };
    const host = document.createElement("div");
    host.id = "chat-bubble-test";
    host.style.cssText = "position:fixed;left:150px;top:200px;z-index:20000";
    document.body.appendChild(host);
    const root = createRoot(host);
    globalThis.chatBubbleTest = {
      render: (compact, isLocal, message, clickable, count = 5, isDeadHand = false, isOut = false) => root.render(
        React.createElement(ThemeProvider, null, React.createElement(OpponentSeat, {
          key: `${compact}-${isLocal}-${message}-${count}-${isDeadHand}-${isOut}`,
          player: { id: "test-player", name: "Test Player", handCount: count, role: "Neutral", isDeadHand, sidelinedCount: count },
          isActive: false,
          isOut,
          hasPassed: false,
          compact,
          isLocal,
          layoutWidth: 320,
          tableChatMessage: message,
          onAvatarPress: clickable ? () => {} : undefined,
        })),
      ),
    };
  });

  for (const [compact, isLocal, text, clickable] of [
    [false, false, "Good play", true],
    [true, false, "Hurry up", true],
    [false, true, "Well played", false],
    [true, true, "Nice one", false],
  ]) {
    await page.evaluate(([c, local, message, pressable]) => globalThis.chatBubbleTest.render(c, local, message, pressable), [compact, isLocal, text, clickable]);
    const bubble = page.locator("#chat-bubble-test").getByText(text, { exact: true });
    await bubble.waitFor();
    await page.waitForTimeout(650);
    const bubbleBox = await bubble.evaluate((element) => {
      const rect = element.parentElement.parentElement.getBoundingClientRect();
      return { left: rect.left, right: rect.right, bottom: rect.bottom, height: rect.height };
    });
    const avatarBox = await page.locator("#chat-bubble-test").getByText("TP", { exact: true }).evaluate((element) => {
      const rect = element.parentElement.parentElement.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width };
    });
    assert.ok(bubbleBox.bottom <= avatarBox.y, `${text}: bubble bottom ${bubbleBox.bottom} overlaps avatar top ${avatarBox.y}`);
    assert.ok(bubbleBox.height <= 50, `${text}: bubble is unnecessarily wrapped (${bubbleBox.height}px high)`);
    assert.ok(
      Math.abs((bubbleBox.left + bubbleBox.right) / 2 - (avatarBox.x + avatarBox.width / 2)) < 1,
      `${text}: bubble is not centered above the avatar`,
    );
  }
  for (const [compact, isLocal, count, isDeadHand] of [
    [false, true, 5, false],
    [true, false, 12, false],
    [true, false, 54, true],
  ]) {
    await page.evaluate((args) => globalThis.chatBubbleTest.render(...args),
      [compact, isLocal, "", false, count, isDeadHand, false]);
    const badge = page.getByTestId("seat-card-count");
    await badge.waitFor();
    assert.equal(await badge.innerText(), String(count));
    const appearance = await badge.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const text = element.lastElementChild.getBoundingClientRect();
      const avatar = element.parentElement.getBoundingClientRect();
      const size = bounds.height - 8;
      const expected = globalThis.countBadgeGeometry.countBadgeCenterInAvatarWrap(avatar.width, size);
      const stack = globalThis.countBadgeGeometry.dealStackCenterInAvatarWrap(avatar.width, size, 26);
      const back = [...element.querySelectorAll("*")].some(
        (node) => getComputedStyle(node).backgroundColor === "rgb(183, 18, 52)",
      );
      return {
        width: bounds.width, height: bounds.height, back,
        outsetRight: bounds.right - avatar.right,
        outsetBottom: bounds.bottom - avatar.bottom,
        geometryMatches: Math.abs(bounds.left + bounds.width / 2 - avatar.left - expected.x) < 1 &&
          Math.abs(bounds.top + bounds.height / 2 - avatar.top - expected.y) < 1,
        stackAbove: stack.y + 13 <= bounds.top - avatar.top - 3,
        textFits: text.left >= bounds.left && text.right <= bounds.right &&
          text.top >= bounds.top && text.bottom <= bounds.bottom,
      };
    });
    assert.ok(appearance.height > appearance.width && appearance.back && appearance.textFits &&
      appearance.geometryMatches && appearance.stackAbove,
      `${count}: badge should show a readable count on a portrait card back`);
    assert.ok(Math.abs(appearance.outsetRight - 12) < 1 &&
      Math.abs(appearance.outsetBottom - 8) < 1,
    `${count}: badge should extend 12px right and 8px below the avatar`);
  }
  for (const [count, isDeadHand, isOut] of [[5, false, true], [0, true, false]]) {
    await page.evaluate((args) => globalThis.chatBubbleTest.render(...args),
      [false, false, "", false, count, isDeadHand, isOut]);
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId("seat-card-count").count(), 0);
  }
  console.log("test-table-chat-bubble-web: ok");
} finally {
  await browser.close();
}
