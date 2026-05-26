import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import OpponentRing from "./OpponentRing";
import { computePlayAreaLayout } from "../utils/tableLayout";

export { LOCAL_SEAT_BAND as LOCAL_SEAT_HEIGHT } from "../utils/tableLayout";

type RingProps = Omit<
  React.ComponentProps<typeof OpponentRing>,
  "arenaWidth" | "arenaHeight" | "ringLayout"
>;

type Props = RingProps & {
  lastPlayPlayerId?: string | null;
  playTypeLabel?: string | null;
};

export default function GamePlayArea({
  players,
  localPlayerIds,
  currentPlayerId,
  finishedOrder,
  passedPlayerIds,
  lastPlayPlayerId,
  playTypeLabel,
  children,
}: Props & { children: React.ReactNode }) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const layout = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return null;
    return computePlayAreaLayout(
      size.width,
      size.height,
      players.length,
    );
  }, [
    size.width,
    size.height,
    players.length,
  ]);

  const tableChild =
    layout && React.isValidElement(children)
      ? React.cloneElement(
          children as React.ReactElement<{
            layoutHint?: typeof layout;
            playTypeLabel?: string | null;
          }>,
          {
            layoutHint: layout,
            playTypeLabel,
          },
        )
      : children;

  return (
    <View style={styles.root} onLayout={onLayout}>
      {layout && layout.cardZoneHeight > 0 && (
        <View
          style={[
            styles.cardZone,
            {
              top: layout.cardZoneTop,
              left: layout.cardZoneLeft,
              width: layout.cardZoneWidth,
              height: layout.cardZoneHeight,
            },
          ]}
          pointerEvents="box-none"
        >
          {tableChild}
        </View>
      )}

      {layout && (
        <View style={styles.seatOverlay} pointerEvents="box-none">
          <OpponentRing
            players={players}
            localPlayerIds={localPlayerIds}
            currentPlayerId={currentPlayerId}
            finishedOrder={finishedOrder}
            passedPlayerIds={passedPlayerIds}
            arenaWidth={layout.width}
            arenaHeight={layout.height}
            ringLayout={layout.opponentRing}
            lastPlayPlayerId={lastPlayPlayerId}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
    minHeight: 0,
  },
  cardZone: {
    position: "absolute",
    zIndex: 8,
  },
  seatOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
});
