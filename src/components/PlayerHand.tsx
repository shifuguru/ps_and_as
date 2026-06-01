import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  View,
  StyleSheet,
  useWindowDimensions,
  LayoutChangeEvent,
  PanResponder,
  Animated,
  Platform,
  type ViewStyle,
} from "react-native";
import Card from "./Card";
import { Card as CardType } from "../game/ruleset";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import { resolveHandMetrics } from "../utils/compactGameLayout";

/** Must match `Card.tsx` default dimensions at comfortable tier */
const BASE_CARD_WIDTH = 86;
const BASE_CARD_HEIGHT = 124;
const SELECT_LIFT = 12;

/** Extra separation on each side of the centred card (when fully centred) */
const CENTER_GUTTER = 10;

const PAN_ACTIVATION_PX = 8;

/** Max rotation (deg) for cards away from the hand-area centre */
const MAX_ANGLE = 18;
/** How high the centred card lifts above the baseline */
const MAX_CENTER_LIFT = 14;
/** Scale at the hand-area centre vs the edges */
const FOCUS_SCALE = 1.1;
const SIDE_SCALE_MIN = 0.9;
/** Horizontal distance (px) at which fan reaches max tilt / min scale */
function fanNormSpan(containerWidth: number, step: number): number {
  return Math.max(step * 2.4, containerWidth * 0.24);
}
/** Padding below card feet inside the hand zone */
const FAN_BOTTOM_PADDING = 0;

/** Headroom above card tops for arc + selected lift + centre scale (comfortable tier) */
const BASE_FAN_HEADROOM = SELECT_LIFT + MAX_CENTER_LIFT + 24;

/** Total height of the hand fan area at comfortable tier — used when shell height is unknown. */
export const HAND_FAN_HEIGHT =
  BASE_CARD_HEIGHT + BASE_FAN_HEADROOM + FAN_BOTTOM_PADDING;

type Props = {
  cards: CardType[];
  selectedIndices: number[];
  playableIndices: boolean[];
  /** Index of the 3♣ when it must be played to open — pulses like Pass flash */
  startingCardIndex?: number;
  disabled?: boolean;
  onCardPress: (index: number) => void;
};

export type PlayerHandHandle = {
  scrollToIndex: (index: number) => void;
};

type CarouselSlot = {
  left: number;
  bottom: number;
  angle: number;
  scale: number;
  zIndex: number;
  opacity: number;
  compact: boolean;
};

/** Horizontal step — tighter overlap, scales slightly with hand size */
function carouselStep(
  count: number,
  containerWidth: number,
  cardWidth: number,
): number {
  if (count <= 1) return cardWidth;
  const slots = Math.min(count - 1, 9);
  const fitStep = (containerWidth * 0.52) / slots;
  return Math.round(Math.max(26, Math.min(32, fitStep)));
}

/** After a card is played, pick the index that keeps the carousel in the same rank area */
function indexAfterPlay(
  cards: CardType[],
  anchorRank: number | null,
  anchorIndex: number,
): number {
  if (cards.length === 0) return 0;
  if (anchorRank == null) {
    return Math.min(Math.max(0, anchorIndex), cards.length - 1);
  }

  const sameRank = cards.findIndex((c) => c.value === anchorRank);
  if (sameRank >= 0) return sameRank;

  const nextHigher = cards.findIndex((c) => c.value > anchorRank);
  if (nextHigher >= 0) return nextHigher;

  return cards.length - 1;
}

function cardLeft(
  index: number,
  focusedIndex: number,
  gutter: number,
  step: number,
) {
  const base = index * step;
  if (index < focusedIndex) return base - gutter;
  if (index > focusedIndex) return base + gutter;
  return base;
}

function gutterForScroll(
  count: number,
  containerWidth: number,
  scrollOffset: number,
  step: number,
  cardWidth: number,
): number {
  if (count <= 1) return 0;
  const focused = focusedCardIndex(
    count,
    containerWidth,
    scrollOffset,
    step,
    cardWidth,
  );
  const idealScroll = scrollToCenterCard(focused, containerWidth, step, cardWidth);
  const dist = Math.abs(scrollOffset - idealScroll);
  const fadeRange = step * 0.75;
  const t = Math.max(0, 1 - dist / fadeRange);
  return CENTER_GUTTER * t * t;
}

function scrollBounds(
  count: number,
  containerWidth: number,
  step: number,
  cardWidth: number,
) {
  if (count <= 0) return { min: 0, max: 0 };
  if (count === 1) {
    const centered = scrollToCenterCard(0, containerWidth, step, cardWidth);
    return { min: centered, max: centered };
  }
  const min = scrollToCenterCard(0, containerWidth, step, cardWidth);
  const max = scrollToCenterCard(count - 1, containerWidth, step, cardWidth);
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function scrollToCenterCard(
  index: number,
  containerWidth: number,
  step: number,
  cardWidth: number,
) {
  return index * step + cardWidth / 2 - containerWidth / 2;
}

function clampScroll(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function focusedCardIndex(
  count: number,
  containerWidth: number,
  scrollOffset: number,
  step: number,
  cardWidth: number,
): number {
  if (count === 0) return 0;
  const viewportCenter = containerWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const cardCenterX =
      cardLeft(i, i, 0, step) + cardWidth / 2 - scrollOffset;
    const dist = Math.abs(cardCenterX - viewportCenter);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function snapScroll(
  scrollOffset: number,
  count: number,
  containerWidth: number,
  min: number,
  max: number,
  step: number,
  cardWidth: number,
) {
  const index = focusedCardIndex(
    count,
    containerWidth,
    scrollOffset,
    step,
    cardWidth,
  );
  return clampScroll(
    scrollToCenterCard(index, containerWidth, step, cardWidth),
    min,
    max,
  );
}

function computeCarouselSlots(
  count: number,
  containerWidth: number,
  scrollOffset: number,
  step: number,
  cardWidth: number,
  maxCenterLift: number,
  focusOverride?: number | null,
): CarouselSlot[] {
  if (count === 0) return [];

  const handCenterX = containerWidth / 2;
  const focused =
    focusOverride != null
      ? Math.max(0, Math.min(focusOverride, count - 1))
      : focusedCardIndex(
          count,
          containerWidth,
          scrollOffset,
          step,
          cardWidth,
        );
  const gutter = gutterForScroll(count, containerWidth, scrollOffset, step, cardWidth);
  const normSpan = fanNormSpan(containerWidth, step);

  return Array.from({ length: count }, (_, i) => {
    const left = cardLeft(i, focused, gutter, step);
    const symmetricCenterX = i * step + cardWidth / 2 - scrollOffset;
    const distFromCenter = symmetricCenterX - handCenterX;
    const norm = Math.max(-1, Math.min(1, distFromCenter / normSpan));
    const absNorm = Math.min(1, Math.abs(norm));

    const angle = norm * MAX_ANGLE;
    const bottom = maxCenterLift * (1 - absNorm * absNorm);
    const scale =
      SIDE_SCALE_MIN + (1 - absNorm) * (FOCUS_SCALE - SIDE_SCALE_MIN);

    const zIndex =
      1000 + Math.round((1 - absNorm) * 100) - Math.abs(i - focused) * 5 + i;
    const opacity = Math.max(0.92, 1 - absNorm * 0.08);
    const compact = i !== focused;

    return { left, bottom, angle, scale, zIndex, opacity, compact };
  });
}

function pivotAroundBottom(
  angleDeg: number,
  cardWidth: number,
  cardHeight: number,
  scale = 1,
): ViewStyle["transform"] {
  return [
    { translateX: cardWidth / 2 },
    { translateY: cardHeight },
    { rotate: `${angleDeg}deg` },
    { scale },
    { translateX: -cardWidth / 2 },
    { translateY: -cardHeight },
  ];
}

const PlayerHand = forwardRef<PlayerHandHandle, Props>(function PlayerHand(
  {
    cards,
    selectedIndices,
    playableIndices,
    startingCardIndex = -1,
    disabled,
    onCardPress,
  },
  ref,
) {
  const { width: windowWidth } = useWindowDimensions();
  const { height: shellHeight } = useVisualViewportSize();
  const handMetrics = useMemo(
    () => resolveHandMetrics(shellHeight),
    [shellHeight],
  );
  const cardWidth = handMetrics.cardWidth;
  const cardHeight = handMetrics.cardHeight;
  const fanHeight = handMetrics.fanHeight;
  const fanHeadroom = fanHeight - cardHeight;
  const maxCenterLift = Math.round(
    MAX_CENTER_LIFT * (cardHeight / BASE_CARD_HEIGHT),
  );

  const [measuredWidth, setMeasuredWidth] = useState(windowWidth);
  const [scrollOffset, setScrollOffset] = useState(0);

  const layoutWidth = measuredWidth > 0 ? measuredWidth : windowWidth;

  /** Card tapped to focus — expanded and raised until carousel centres it */
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  const step = useMemo(
    () => carouselStep(cards.length, layoutWidth, cardWidth),
    [cards.length, layoutWidth, cardWidth],
  );

  const bounds = useMemo(
    () => scrollBounds(cards.length, layoutWidth, step, cardWidth),
    [cards.length, layoutWidth, step, cardWidth],
  );

  const stripWidth = useMemo(
    () =>
      cards.length === 0
        ? layoutWidth
        : (cards.length - 1) * step + cardWidth + CENTER_GUTTER * 2,
    [cards.length, layoutWidth, step, cardWidth],
  );

  const focusedIndex = useMemo(
    () =>
      focusedCardIndex(
        cards.length,
        layoutWidth,
        scrollOffset,
        step,
        cardWidth,
      ),
    [cards.length, layoutWidth, scrollOffset, step, cardWidth],
  );

  /** Which card is visually centred / expanded in the fan */
  const displayFocusIndex = pendingFocusIndex ?? focusedIndex;

  const slots = useMemo(
    () =>
      computeCarouselSlots(
        cards.length,
        layoutWidth,
        scrollOffset,
        step,
        cardWidth,
        maxCenterLift,
        displayFocusIndex,
      ),
    [
      cards.length,
      layoutWidth,
      scrollOffset,
      step,
      cardWidth,
      maxCenterLift,
      displayFocusIndex,
    ],
  );

  useEffect(() => {
    if (pendingFocusIndex == null) return;
    if (focusedIndex === pendingFocusIndex) {
      setPendingFocusIndex(null);
    }
  }, [focusedIndex, pendingFocusIndex]);

  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(0);
  const grantScrollRef = useRef(0);
  const boundsRef = useRef(bounds);
  const layoutWidthRef = useRef(layoutWidth);
  const stepRef = useRef(step);
  const cardWidthRef = useRef(cardWidth);
  const cardCountRef = useRef(-1);
  const anchorRankRef = useRef<number | null>(null);
  const anchorIndexRef = useRef(0);
  const isDraggingRef = useRef(false);
  const handOuterRef = useRef<View>(null);
  const cardsLengthRef = useRef(cards.length);
  cardsLengthRef.current = cards.length;

  boundsRef.current = bounds;
  layoutWidthRef.current = layoutWidth;
  stepRef.current = step;
  cardWidthRef.current = cardWidth;

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      setScrollOffset(value);
    });
    return () => scrollX.removeListener(id);
  }, [scrollX]);

  const applyScroll = (value: number) => {
    const { min, max } = boundsRef.current;
    const clamped = clampScroll(value, min, max);
    scrollRef.current = clamped;
    scrollX.setValue(clamped);
    setScrollOffset((prev) => (prev === clamped ? prev : clamped));
    return clamped;
  };

  useEffect(() => {
    const card = cards[focusedIndex];
    if (card) {
      anchorRankRef.current = card.value;
      anchorIndexRef.current = focusedIndex;
    }
  }, [cards, focusedIndex]);

  useEffect(() => {
    const prev = cardCountRef.current;
    const next = cards.length;
    if (prev === next) return;

    const w = layoutWidthRef.current;
    const cw = cardWidthRef.current;
    const s = carouselStep(next, w, cw);
    stepRef.current = s;
    const b = scrollBounds(next, w, s, cw);
    boundsRef.current = b;

    if (prev < 0 || next > prev) {
      const middle = Math.floor((next - 1) / 2);
      const targetScroll = scrollToCenterCard(middle, w, s, cw);
      applyScroll(clampScroll(targetScroll, b.min, b.max));
      anchorRankRef.current = cards[middle]?.value ?? cards[0]?.value ?? null;
      anchorIndexRef.current = middle;
    } else {
      const target = indexAfterPlay(
        cards,
        anchorRankRef.current,
        anchorIndexRef.current,
      );
      const targetScroll = scrollToCenterCard(target, w, s, cw);
      applyScroll(clampScroll(targetScroll, b.min, b.max));
      anchorRankRef.current = cards[target]?.value ?? null;
      anchorIndexRef.current = target;
    }

    cardCountRef.current = next;
  }, [cards.length, scrollX]);

  useEffect(() => {
    if (isDraggingRef.current) return;
    applyScroll(scrollRef.current);
  }, [layoutWidth, bounds.min, bounds.max, step]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          cards.length > 1 &&
          Math.abs(gesture.dx) > PAN_ACTIVATION_PX &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          cards.length > 1 &&
          Math.abs(gesture.dx) > PAN_ACTIVATION_PX &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderGrant: () => {
          isDraggingRef.current = true;
          scrollX.stopAnimation((value) => {
            grantScrollRef.current = value;
            scrollRef.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          applyScroll(grantScrollRef.current - gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          isDraggingRef.current = false;
          const { min, max } = boundsRef.current;
          const dragEnd = clampScroll(
            grantScrollRef.current - gesture.dx,
            min,
            max,
          );

          const velocityShift = clampScroll(
            dragEnd - gesture.vx * 0.08,
            min,
            max,
          );
          const snapped = snapScroll(
            velocityShift,
            cards.length,
            layoutWidthRef.current,
            min,
            max,
            stepRef.current,
            cardWidthRef.current,
          );

          scrollRef.current = snapped;
          scrollX.stopAnimation();

          Animated.spring(scrollX, {
            toValue: snapped,
            useNativeDriver: true,
            stiffness: 320,
            damping: 32,
            mass: 0.7,
          }).start(({ finished }) => {
            if (finished) scrollRef.current = snapped;
          });
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [cards.length, scrollX],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - measuredWidth) > 3) {
      setMeasuredWidth(w);
    }
  };

  const scrollToIndex = (index: number) => {
    if (cards.length === 0) return;
    const target = Math.max(0, Math.min(index, cards.length - 1));
    const w = layoutWidthRef.current;
    const cw = cardWidthRef.current;
    const s = stepRef.current;
    const b = boundsRef.current;
    const targetScroll = scrollToCenterCard(target, w, s, cw);
    const clamped = clampScroll(targetScroll, b.min, b.max);
    scrollRef.current = clamped;
    scrollX.stopAnimation();
    Animated.spring(scrollX, {
      toValue: clamped,
      useNativeDriver: true,
      stiffness: 320,
      damping: 32,
      mass: 0.7,
    }).start(({ finished }) => {
      if (finished) scrollRef.current = clamped;
    });
    anchorRankRef.current = cards[target]?.value ?? null;
    anchorIndexRef.current = target;
    setPendingFocusIndex(target);
  };

  const handleCardPress = (index: number) => {
    if (disabled) return;
    if (index !== focusedIndex) {
      setPendingFocusIndex(index);
      scrollToIndex(index);
    }
    onCardPress(index);
  };

  useImperativeHandle(ref, () => ({ scrollToIndex }), [cards]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = handOuterRef.current as any;
    if (!node) return;

    const onWheel = (event: any) => {
      if (cardsLengthRef.current <= 1) return;
      event.preventDefault?.();

      const deltaY = event.deltaY ?? 0;
      const deltaX = event.deltaX ?? 0;
      const delta =
        Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
      if (Math.abs(delta) < 1) return;

      const count = cardsLengthRef.current;
      const w = layoutWidthRef.current;
      const cw = cardWidthRef.current;
      const s = stepRef.current;
      const { min, max } = boundsRef.current;

      const direction = delta > 0 ? 1 : -1;
      const currentIndex = focusedCardIndex(count, w, scrollRef.current, s, cw);
      const nextIndex = Math.max(0, Math.min(count - 1, currentIndex + direction));
      if (nextIndex === currentIndex) return;

      const snapped = clampScroll(
        scrollToCenterCard(nextIndex, w, s, cw),
        min,
        max,
      );
      scrollRef.current = snapped;
      scrollX.stopAnimation();
      Animated.spring(scrollX, {
        toValue: snapped,
        useNativeDriver: true,
        stiffness: 320,
        damping: 32,
        mass: 0.7,
      }).start(({ finished }) => {
        if (finished) scrollRef.current = snapped;
      });
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [scrollX]);

  return (
    <View
      ref={handOuterRef}
      style={[styles.handOuter, { height: fanHeight }]}
      onLayout={onLayout}
      {...(cards.length > 1 ? panResponder.panHandlers : {})}
    >
      <Animated.View
        style={[
          styles.fanStrip,
          {
            width: Math.max(stripWidth, layoutWidth),
            height: cardHeight + fanHeadroom,
            transform: [{ translateX: Animated.multiply(scrollX, -1) }],
          },
        ]}
      >
        {cards.map((card, index) => {
          const slot = slots[index];
          if (!slot) return null;

          const isSelected = selectedIndices.includes(index);
          const isPlayable = playableIndices[index] ?? true;
          const isFocused = index === displayFocusIndex;
          const isPressed = pressedIndex === index;

          return (
            <View
              key={`${card.suit}-${card.value}-${index}`}
              style={[
                styles.cardSlot,
                {
                  left: slot.left,
                  bottom: slot.bottom,
                  width: cardWidth,
                  height: cardHeight,
                  zIndex: isSelected
                    ? 2000 + slot.zIndex
                    : isPressed || index === pendingFocusIndex
                      ? 2500 + index
                      : slot.zIndex,
                  opacity: isSelected ? 1 : slot.opacity,
                  transform: pivotAroundBottom(
                    slot.angle,
                    cardWidth,
                    cardHeight,
                    slot.scale,
                  ),
                },
              ]}
              onTouchStart={() => setPressedIndex(index)}
              onTouchEnd={() => setPressedIndex(null)}
              onTouchCancel={() => setPressedIndex(null)}
            >
              <Card
                card={card}
                selected={isSelected}
                compact={slot.compact && !isSelected}
                highlight={isPlayable ? (isSelected ? 1 : isFocused ? 0.65 : 0.2) : 0}
                flash={index === startingCardIndex}
                disabled={disabled || !isPlayable}
                onPress={() => handleCardPress(index)}
                style={{ width: cardWidth, height: cardHeight }}
              />
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
});

export default PlayerHand;

const styles = StyleSheet.create({
  handOuter: {
    width: "100%",
    overflow: "visible",
  },
  fanStrip: {
    position: "absolute",
    left: 0,
    bottom: FAN_BOTTOM_PADDING,
  },
  cardSlot: {
    position: "absolute",
  },
});
