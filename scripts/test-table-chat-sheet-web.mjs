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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
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
      "src/components/TableChatModal.tsx",
      "src/context/ThemeContext.tsx",
    ].every((name) => names.includes(name));
  }, null, { timeout: 60000 });

  const mountSheet = () => {
    const modules = globalThis.__r.getModules();
    const get = (name) => {
      const entry = [...modules.entries()].find(([, module]) => module.verboseName === name);
      if (!entry) throw new Error(`Missing Metro module: ${name}`);
      return globalThis.__r(entry[0]);
    };
    const React = get("node_modules/react/index.js");
    const { createRoot } = get("node_modules/react-dom/client.js");
    const Modal = get("src/components/TableChatModal.tsx").default;
    const { ThemeProvider, useAppTheme } = get("src/context/ThemeContext.tsx");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    function ChatSheet() {
      globalThis.tableChatSheetTest.setAppearance = useAppTheme().setAppearancePreference;
      return React.createElement(Modal, {
        visible: globalThis.tableChatSheetTest.visible,
        onClose: () => { globalThis.tableChatSheetTest.closed += 1; },
        onSelect: (id) => { globalThis.tableChatSheetTest.selected.push(id); },
      });
    }
    globalThis.tableChatSheetTest = {
      selected: [],
      closed: 0,
      render: (visible) => {
        globalThis.tableChatSheetTest.visible = visible;
        root.render(React.createElement(ThemeProvider, null, React.createElement(ChatSheet)));
      },
    };
    globalThis.tableChatSheetTest.render(true);
  };
  await page.evaluate(mountSheet);

  const optionNames = [
    "Nice one", "Good play", "Well played", "Nice try", "Oops", "Sorry",
    "My bad", "GG", "One sec", "BRB", "Hurry up", "Good luck",
  ];
  const sheet = page.getByTestId("quick-chat-sheet");
  await sheet.waitFor();
  await sheet.evaluate((element) => {
    let portal = element;
    while (portal.parentElement !== document.body) portal = portal.parentElement;
    for (const child of document.body.children) {
      if (child !== portal) child.style.display = "none";
    }
  });
  const options = () => sheet.getByRole("button").filter({ has: page.getByTestId("quick-chat-option-tail") });
  const hint = page.getByText("Pull up for more", { exact: true });

  await page.waitForTimeout(1000);
  assert.equal(await options().count(), 12, "all options should fit on a tall phone");
  assert.equal(await hint.count(), 0, "no expansion hint when all options fit");
  assert.equal(await page.getByLabel("Expand quick chat").count(), 0);
  const initialBox = await sheet.boundingBox();
  assert.ok(Math.abs(initialBox.width - 390) < 1);
  const initialOptionBoxes = await Promise.all(optionNames.map((name) =>
    page.getByRole("button", { name, exact: true }).boundingBox()));
  const initialBottom = Math.max(...initialOptionBoxes.map((box) => box.y + box.height));
  assert.ok(initialBox.y + initialBox.height - initialBottom < 18,
    "sheet should fit its content when everything is visible");
  const firstThree = await Promise.all(optionNames.slice(0, 3).map((name) =>
    page.getByRole("button", { name, exact: true }).boundingBox()));
  assert.ok(firstThree.every((box) => Math.abs(box.y - firstThree[0].y) < 1));
  assert.notEqual(firstThree[0].width, firstThree[2].width);
  const firstGap = firstThree[1].x - (firstThree[0].x + firstThree[0].width);
  const secondGap = firstThree[2].x - (firstThree[1].x + firstThree[1].width);
  assert.ok(Math.abs(firstGap - secondGap) < 1, "options should be evenly justified");
  assert.ok(Math.abs(initialBox.x + initialBox.width - 29 -
    (firstThree[2].x + firstThree[2].width)) < 1, "row should reach the right edge");
  for (const box of initialOptionBoxes) {
    assert.ok(box.x - initialBox.x >= 28 && initialBox.x + initialBox.width - box.x - box.width >= 28,
      "options should have at least 28px of horizontal inset");
  }
  for (let i = 0; i < initialOptionBoxes.length; i += 1) {
    for (let j = i + 1; j < initialOptionBoxes.length; j += 1) {
      const a = initialOptionBoxes[i];
      const b = initialOptionBoxes[j];
      const horizontalGap = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width));
      const verticalGap = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height));
      assert.ok(horizontalGap >= 23.5 || verticalGap >= 23.5,
        `${optionNames[i]} and ${optionNames[j]} need at least 24px separation`);
    }
  }

  for (const mode of ["dark", "light"]) {
    await page.evaluate((value) => globalThis.tableChatSheetTest.setAppearance(value), mode);
    for (const name of optionNames) {
      const option = page.getByRole("button", { name, exact: true });
      const appearance = await option.evaluate((element) => {
        const body = element.firstElementChild;
        const tail = element.querySelector('[data-testid="quick-chat-option-tail"]');
        const bodyRect = body.getBoundingClientRect();
        const tailRect = tail.getBoundingClientRect();
        return {
          background: getComputedStyle(body).backgroundColor,
          blur: getComputedStyle(body).backdropFilter,
          tailColor: getComputedStyle(tail).borderTopColor,
          tailLeft: tailRect.left - bodyRect.left,
          tailBottom: tailRect.bottom - bodyRect.bottom,
          height: element.getBoundingClientRect().height,
          width: element.getBoundingClientRect().width,
        };
      });
      assert.match(appearance.background, /^rgba\(25, 25, 25, 0\.7/);
      assert.match(appearance.blur, /blur\([1-9]/);
      assert.match(appearance.tailColor, /^rgba\(135, 145, 140, 0\.9/);
      assert.ok(Math.abs(appearance.tailLeft - 16) < 1 && appearance.tailBottom > 0);
      assert.ok(appearance.height >= 44);
      assert.ok(appearance.width >= 44);
    }
  }
  const firstOption = page.getByRole("button", { name: "Nice one", exact: true });
  const firstOptionBox = await firstOption.boundingBox();
  const firstX = firstOptionBox.x + firstOptionBox.width / 2;
  const firstY = firstOptionBox.y + firstOptionBox.height / 2;
  await page.mouse.move(firstX, firstY);
  const isHighlighted = () => {
    const body = document.querySelector('[aria-label="Nice one"]')?.firstElementChild;
    return [...(body?.children ?? [])].some((child) =>
      getComputedStyle(child).backgroundColor === "rgba(255, 255, 255, 0.28)");
  };
  await page.waitForFunction(isHighlighted);
  await page.mouse.move(2, 2);
  await page.waitForFunction((check) => {
    const body = document.querySelector('[aria-label="Nice one"]')?.firstElementChild;
    return ![...(body?.children ?? [])].some((child) =>
      getComputedStyle(child).backgroundColor === check);
  }, "rgba(255, 255, 255, 0.28)");
  const client = await context.newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart", touchPoints: [{ x: firstX, y: firstY }],
  });
  await page.waitForFunction(isHighlighted);
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.deepEqual(await page.evaluate(() => globalThis.tableChatSheetTest.selected), ["nice-one"]);

  await page.setViewportSize({ width: 390, height: 600 });
  await page.getByLabel("Expand quick chat").waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
  const collapsedCount = await options().count();
  assert.ok(collapsedCount > 4 && collapsedCount < 12,
    `expected as many complete rows as fit, got ${collapsedCount}`);
  assert.equal(await hint.count(), 1);
  const collapsedBox = await sheet.boundingBox();
  assert.ok(collapsedBox.height <= 241, "collapsed sheet should fit its initial height limit");
  const hintBox = await hint.boundingBox();
  const collapsedOptions = await options().all();
  for (const option of collapsedOptions) {
    const box = await option.boundingBox();
    assert.ok(box.y + box.height <= hintBox.y + 1, "initial options must not be clipped");
  }

  async function dragHandle(distance) {
    const box = await page.getByLabel(/(?:Expand|Collapse) quick chat/).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x, y: y + distance * step / 8 }],
      });
      await page.waitForTimeout(35);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await dragHandle(-60);
  await page.getByLabel("Collapse quick chat").waitFor({ timeout: 3000 });
  await page.waitForTimeout(700);
  assert.equal(await options().count(), 12);
  assert.equal(await hint.count(), 0);
  await page.getByRole("button", { name: "Good luck", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => globalThis.tableChatSheetTest.selected), ["nice-one", "good-luck"]);
  await page.getByLabel("Collapse quick chat").focus();
  await page.keyboard.press("ArrowDown");
  await page.getByLabel("Expand quick chat").waitFor({ timeout: 3000 });
  assert.ok(await options().count() < 12);
  await page.getByLabel("Expand quick chat").focus();
  await page.keyboard.press("ArrowUp");
  await page.getByLabel("Collapse quick chat").waitFor({ timeout: 3000 });

  await page.setViewportSize({ width: 900, height: 844 });
  await page.waitForTimeout(1000);
  assert.equal(await options().count(), 12);
  assert.equal(await hint.count(), 0);
  assert.equal(await page.getByLabel("Expand quick chat").count(), 0);
  assert.equal(await page.getByLabel("Collapse quick chat").count(), 0);
  assert.ok(Math.abs((await sheet.boundingBox()).width - 900) < 1);

  await page.setViewportSize({ width: 320, height: 300 });
  await page.getByLabel("Expand quick chat").waitFor({ timeout: 5000 });
  await page.getByLabel("Expand quick chat").focus();
  await page.keyboard.press("ArrowUp");
  await page.getByLabel("Collapse quick chat").waitFor({ timeout: 3000 });
  await page.waitForTimeout(700);
  const shortSheet = await sheet.boundingBox();
  assert.ok(shortSheet.height <= 256, "expanded sheet must fit the viewport");
  const finalOption = page.getByRole("button", { name: "Good luck", exact: true });
  await finalOption.scrollIntoViewIfNeeded();
  const finalBox = await finalOption.boundingBox();
  assert.ok(finalBox.y >= shortSheet.y && finalBox.y + finalBox.height <= shortSheet.y + shortSheet.height);
  await page.getByLabel("Close quick chat").click({ position: { x: 10, y: 10 } });
  assert.equal(await page.evaluate(() => globalThis.tableChatSheetTest.closed), 1);
  await page.evaluate(() => globalThis.tableChatSheetTest.render(false));
  await page.waitForTimeout(100);
  await page.setViewportSize({ width: 390, height: 550 });
  await page.evaluate(() => globalThis.tableChatSheetTest.render(true));
  await page.getByLabel("Expand quick chat").waitFor({ timeout: 5000 });
  await page.waitForTimeout(700);
  await dragHandle(80);
  assert.equal(await page.evaluate(() => globalThis.tableChatSheetTest.closed), 2);

  const desktop = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(process.env.EXPO_WEB_URL ?? "http://localhost:8081/", {
    waitUntil: "domcontentloaded",
  });
  await desktopPage.waitForFunction(() => {
    const modules = globalThis.__r?.getModules?.();
    return modules && [...modules.values()].some((module) =>
      module.verboseName === "src/components/TableChatModal.tsx");
  }, null, { timeout: 60000 });
  await desktopPage.evaluate(mountSheet);
  const desktopSheet = desktopPage.getByTestId("quick-chat-sheet");
  await desktopSheet.waitFor();
  await desktopSheet.evaluate((element) => {
    let portal = element;
    while (portal.parentElement !== document.body) portal = portal.parentElement;
    for (const child of document.body.children) {
      if (child !== portal) child.style.display = "none";
    }
  });
  await desktopPage.waitForTimeout(1000);
  assert.equal(await desktopPage.getByLabel("Quick chat handle").count(), 0);
  assert.equal(await desktopPage.getByLabel("Expand quick chat").count(), 0);
  const desktopBoxes = await Promise.all(optionNames.map((name) =>
    desktopPage.getByRole("button", { name, exact: true }).boundingBox()));
  const leftEdge = Math.min(...desktopBoxes.map((box) => box.x));
  const rightEdge = Math.max(...desktopBoxes.map((box) => box.x + box.width));
  assert.ok(rightEdge - leftEdge <= 641, "desktop options should have a bounded width");
  assert.ok(Math.abs((leftEdge + rightEdge) / 2 - 600) < 1, "desktop options should be centered");
  await desktopPage.getByRole("button", { name: "Nice one", exact: true }).hover();
  await desktopPage.waitForFunction(isHighlighted);
  await desktopPage.setViewportSize({ width: 1200, height: 300 });
  await desktopPage.getByLabel("Expand quick chat").waitFor({ timeout: 5000 });
  await desktopPage.getByLabel("Expand quick chat").focus();
  await desktopPage.keyboard.press("ArrowUp");
  await desktopPage.getByLabel("Collapse quick chat").waitFor({ timeout: 3000 });
  await desktop.close();
  console.log("test-table-chat-sheet-web: ok");
} finally {
  await browser.close();
}
