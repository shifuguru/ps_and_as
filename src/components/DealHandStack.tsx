import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Card from "./Card";
import { ceremonyCardCornerRadius } from "./cardDimensions";
import { FULL_DECK_SIZE } from "../game/ruleset";

/** Max pile spread so a full deck still fits in the hand / table zone. */
const MAX_SPREAD_X_RATIO = 0.35;
const MAX_SPREAD_Y_RATIO = 0.12;
const MAX_SPREAD_X_PX = 28;
const MAX_SPREAD_Y_PX = 14;
const SLIVER_LAYERS = 4;

const SLIVER_TONES = ["#a10f2d", "#961028", "#8a0c24", "#7e0a20"];

/** Fixed step for a full deck — remaining cards keep their positions as the pile shrinks. */
export function handDealStackSteps(
  cardWidth: number,
  cardHeight: number,
  deckSize: number = FULL_DECK_SIZE,
): { stepX: number; stepY: number } {
  if (deckSize <= 1) return { stepX: 0, stepY: 0 };
  const maxSpreadX = Math.min(cardWidth * MAX_SPREAD_X_RATIO, MAX_SPREAD_X_PX);
  const maxSpreadY = Math.min(cardHeight * MAX_SPREAD_Y_RATIO, MAX_SPREAD_Y_PX);
  return {
    stepX: maxSpreadX / (deckSize - 1),
    stepY: maxSpreadY / (deckSize - 1),
  };
}

export function handDealStackSize(
  count: number,
  cardWidth: number,
  cardHeight: number,
  deckSize: number = FULL_DECK_SIZE,
): { width: number; height: number; stepX: number; stepY: number } {
  if (count <= 0) {
    return { width: 0, height: 0, stepX: 0, stepY: 0 };
  }
  const { stepX, stepY } = handDealStackSteps(cardWidth, cardHeight, deckSize);
  return {
    width: cardWidth + (count - 1) * stepX,
    height: cardHeight + (count - 1) * stepY,
    stepX,
    stepY,
  };
}

/** Offset of the top card from the stack origin (bottom-left of pile). */
export function handDealStackTopOffset(
  count: number,
  cardWidth: number,
  cardHeight: number,
  deckSize: number = FULL_DECK_SIZE,
): { x: number; y: number } {
  if (count <= 0) return { x: 0, y: 0 };
  const { stepX, stepY } = handDealStackSteps(cardWidth, cardHeight, deckSize);
  const top = count - 1;
  return { x: top * stepX, y: top * stepY };
}

/** Center point of the top card when the stack is centered on (0,0). */
export function handDealStackTopCardCenter(
  count: number,
  cardWidth: number,
  cardHeight: number,
  deckSize: number = FULL_DECK_SIZE,
): { x: number; y: number } {
  if (count <= 0) return { x: 0, y: 0 };
  const { width, height } = handDealStackSize(
    count,
    cardWidth,
    cardHeight,
    deckSize,
  );
  const topOff = handDealStackTopOffset(
    count,
    cardWidth,
    cardHeight,
    deckSize,
  );
  return {
    x: -width / 2 + topOff.x + cardWidth / 2,
    y: -height / 2 + topOff.y + cardHeight / 2,
  };
}

/** Position a pile so its visual center sits on the parent's origin. */
export function handDealStackCenterFrame(
  count: number,
  cardWidth: number,
  cardHeight: number,
  deckSize: number = FULL_DECK_SIZE,
): { width: number; height: number; left: number; top: number } {
  const { width, height } = handDealStackSize(
    count,
    cardWidth,
    cardHeight,
    deckSize,
  );
  return {
    width,
    height,
    left: -width / 2,
    top: -height / 2,
  };
}

type PileProps = {
  count: number;
  cardWidth: number;
  cardHeight: number;
  /** Full deck size — spacing stays fixed as cards are dealt. */
  deckSize?: number;
};

function CardBackSliver({
  width,
  height,
  cornerRadius,
  left,
  top,
  zIndex,
  tone,
}: {
  width: number;
  height: number;
  cornerRadius: number;
  left: number;
  top: number;
  zIndex: number;
  tone: string;
}) {
  const innerR = Math.max(2, cornerRadius * 0.55);
  return (
    <View
      style={[
        sliverStyles.shell,
        {
          left,
          top,
          width,
          height,
          borderRadius: cornerRadius,
          zIndex,
          backgroundColor: tone,
        },
      ]}
    >
      <View
        style={[
          sliverStyles.face,
          {
            borderRadius: innerR,
            backgroundColor: tone,
            opacity: 0.92,
          },
        ]}
      />
    </View>
  );
}

/**
 * Face-down pile illusion — stacked back slivers, one real top card.
 * Depth comes from layered card backs, not a drop shadow blob.
 */
export function DealStackPile({
  count,
  cardWidth,
  cardHeight,
  deckSize = FULL_DECK_SIZE,
}: PileProps) {
  const layout = useMemo(() => {
    if (count <= 0) return null;
    const { width, height, stepX, stepY } = handDealStackSize(
      count,
      cardWidth,
      cardHeight,
      deckSize,
    );
    const topOff = handDealStackTopOffset(
      count,
      cardWidth,
      cardHeight,
      deckSize,
    );
    const fill = Math.max(0.12, Math.min(1, count / deckSize));
    const topIndex = count - 1;
    const sliverCount = Math.min(
      SLIVER_LAYERS,
      Math.max(0, count - 1),
    );
    const slivers = Array.from({ length: sliverCount }, (_, i) => {
      const layer = topIndex - sliverCount + i;
      return {
        key: layer,
        left: layer * stepX,
        top: layer * stepY,
        zIndex: i,
        tone: SLIVER_TONES[Math.min(i, SLIVER_TONES.length - 1)],
      };
    });
    const lipPx = Math.max(1, Math.round(1 + fill * 3));
    return {
      width,
      height,
      topOff,
      fill,
      slivers,
      topZ: sliverCount,
      lipPx,
    };
  }, [count, cardWidth, cardHeight, deckSize]);

  if (!layout) return null;

  const cornerRadius = ceremonyCardCornerRadius(cardWidth, cardHeight);
  const { topOff, lipPx } = layout;
  const showLip = count > 1 && lipPx > 0;

  return (
    <View style={[styles.stack, { width: layout.width, height: layout.height }]}>
      {showLip ? (
        <>
          <View
            style={[
              styles.edgeLip,
              {
                left: topOff.x + 2,
                top: topOff.y + cardHeight - 1,
                width: cardWidth - 4,
                height: lipPx,
                borderBottomLeftRadius: Math.max(2, cornerRadius * 0.35),
                borderBottomRightRadius: Math.max(2, cornerRadius * 0.35),
                zIndex: layout.topZ - 1,
              },
            ]}
          />
          <View
            style={[
              styles.edgeLip,
              {
                left: topOff.x + cardWidth - 1,
                top: topOff.y + 3,
                width: lipPx,
                height: cardHeight - 5,
                borderTopRightRadius: Math.max(2, cornerRadius * 0.25),
                borderBottomRightRadius: Math.max(2, cornerRadius * 0.25),
                zIndex: layout.topZ - 1,
              },
            ]}
          />
        </>
      ) : null}
      {layout.slivers.map((s) => (
        <CardBackSliver
          key={s.key}
          width={cardWidth}
          height={cardHeight}
          cornerRadius={cornerRadius}
          left={s.left}
          top={s.top}
          zIndex={s.zIndex}
          tone={s.tone}
        />
      ))}
      <View
        style={[
          styles.topCard,
          topCardShadow(cardWidth),
          {
            left: topOff.x,
            top: topOff.y,
            width: cardWidth,
            height: cardHeight,
            zIndex: layout.topZ,
          },
        ]}
      >
        <Card
          card={{ suit: "spades", value: 0, hidden: true }}
          selected={false}
          faceDown
          disabled
          variant="table"
          cornerRadius={cornerRadius}
          onPress={() => {}}
          style={{ width: cardWidth, height: cardHeight }}
        />
      </View>
    </View>
  );
}

function topCardShadow(cardWidth: number) {
  const radius = Math.max(3, Math.round(cardWidth * 0.05));
  return Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: radius,
    },
    android: {
      elevation: 3,
    },
    default: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      boxShadow: `0 2px ${radius + 2}px rgba(0,0,0,0.12)` as any,
    },
  });
}

type Props = PileProps;

/** Face-down stack in the local hand zone while cards are being dealt. */
export default function DealHandStack({
  count,
  cardWidth,
  cardHeight,
  deckSize = FULL_DECK_SIZE,
}: Props) {
  if (count <= 0) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <DealStackPile
        count={count}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        deckSize={deckSize}
      />
    </View>
  );
}

const sliverStyles = StyleSheet.create({
  shell: {
    position: "absolute",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    margin: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    position: "relative",
  },
  edgeLip: {
    position: "absolute",
    backgroundColor: "#6d0818",
  },
  topCard: {
    position: "absolute",
  },
});
