/**
 * Mount RoundCompleteModal in isolation via react-test-renderer to catch render throws.
 * Run: npx tsx ./scripts/repro-round-complete-render.ts
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import RoundCompleteModal from "../src/components/RoundCompleteModal";

// Minimal theme provider shim — RoundComplete uses useAppTheme.
import { ThemeProvider } from "../src/context/ThemeContext";

function Harness({ visible }: { visible: boolean }) {
  return (
    <ThemeProvider>
      <RoundCompleteModal
        visible={visible}
        finishedOrder={["p1", "p2", "p3", "p4"]}
        players={[
          { id: "p1", name: "Alice" },
          { id: "p2", name: "Bob" },
          { id: "p3", name: "Cara" },
          { id: "p4", name: "Dan" },
        ]}
        readyStates={{}}
        playerXp={{ p1: 100, p2: 80, p3: 60, p4: 40 }}
        playerRoundXp={{ p1: 25, p2: 15, p3: 10, p4: 5 }}
        localPlayerId="p1"
        onQuit={() => {}}
        onToggleReady={() => {}}
        xpAnimationReady
      />
    </ThemeProvider>
  );
}

async function main() {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  try {
    await act(() => {
      tree = TestRenderer.create(<Harness visible={false} />);
    });
    console.log("OK: hidden mount");
    await act(() => {
      tree!.update(<Harness visible={true} />);
    });
    console.log("OK: visible mount");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    console.log("OK: after open delay");
  } catch (e) {
    console.error("RENDER THROW:", e);
    if (e instanceof Error) {
      console.error("message:", e.message);
      console.error("stack:", e.stack);
    }
    process.exit(1);
  }
  process.exit(0);
}

main();
