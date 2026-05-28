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

/** Must match `Card.tsx` dimensions */
const CARD_WIDTH = 86;
const CARD_HEIGHT = 124;
const SELECT_LIFT = 12;

/** Extra separation on each side of the centred card (when fully centred) */
const CENTER_GUTTER = 10;

const PAN_ACTIVATION_PX = 8;

/** Max rotation (deg) for cards at the viewport edge */
const MAX_ANGLE = 16;
/** How high the centred card lifts above the baseline */
const MAX_CENTER_LIFT = 12;
/** Padding below card feet inside the hand zone */
const FAN_BOTTOM_PADDING = 5;

/** Headroom above card tops for arc + selected lift + scale/shadow */
const FAN_HEADROOM = SELECT_LIFT + MAX_CENTER_LIFT + 20;

/** Total height of the hand fan area */
export const HAND_FAN_HEIGHT =
  CARD_HEIGHT + FAN_HEADROOM + FAN_BOTTOM_PADDING;

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
  zIndex: number;
  opacity: number;
  compact: boolean;
};

/** Horizontal step — tighter overlap, scales slightly with hand size */
function carouselStep(count: number, containerWidth: number): number {
  if (count <= 1) return CARD_WIDTH;
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
): number {
  if (count <= 1) return 0;
  const focused = focusedCardIndex(count, containerWidth, scrollOffset, step);
  const idealScroll = scrollToCenterCard(focused, containerWidth, step);
  const dist = Math.abs(scrollOffset - idealScroll);
  const fadeRange = step * 0.75;
  const t = Math.max(0, 1 - dist / fadeRange);
  return CENTER_GUTTER * t * t;
}

function scrollBounds(count: number, containerWidth: number, step: number) {
  if (count <= 0) return { min: 0, max: 0 };
  if (count === 1) {
    const centered = scrollToCenterCard(0, containerWidth, step);
    return { min: centered, max: centered };
  }
  const min = scrollToCenterCard(0, containerWidth, step);
  const max = scrollToCenterCard(count - 1, containerWidth, step);
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function scrollToCenterCard(
  index: number,
  containerWidth: number,
  step: number,
) {
  return index * step + CARD_WIDTH / 2 - containerWidth / 2;
}

function clampScroll(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function focusedCardIndex(
  count: number,
  containerWidth: number,
  scrollOffset: number,
  step: number,
): number {
  if (count === 0) return 0;
  const viewportCenter = containerWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const cardCenterX = cardLeft(i, i, 0, step) + CARD_WIDTH / 2 - scrollOffset;
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
) {
  const index = focusedCardIndex(count, containerWidth, scrollOffset, step);
  return clampScroll(
    scrollToCenterCard(index, containerWidth, step),
    min,
    max,
  );
}

function computeCarouselSlots(
  count: number,
  containerWidth: number,
  scrollOffset: number,
  step: number,
  focusOverride?: number | null,
): CarouselSlot[] {
  if (count === 0) return [];

  const viewportCenter = containerWidth / 2;
  const focused =
    focusOverride != null
      ? Math.max(0, Math.min(focusOverride, count - 1))
      : focusedCardIndex(count, containerWidth, scrollOffset, step);
  const gutter = gutterForScroll(count, containerWidth, scrollOffset, step);
  const rotationRadius = containerWidth * 0.55;

  return Array.from({ length: count }, (_, i) => {
    const left = cardLeft(i, focused, gutter, step);
    const cardCenterX = left + CARD_WIDTH / 2 - scrollOffset;
    const dist = cardCenterX - viewportCenter;
    const norm = Math.max(-1, Math.min(1, dist / rotationRadius));

    const angle = norm * MAX_ANGLE;
    const absNorm = Math.min(1, Math.abs(norm));
    const bottom = MAX_CENTER_LIFT * (1 - absNorm * absNorm);

    const zIndex = 1000 - Math.abs(i - focused) * 10 + i;
    const viewportDist = Math.abs(dist);
    const opacity = Math.max(
      0.94,
      1 - viewportDist / (containerWidth * 1.1),
    );
    const compact = i !== focused;

    return { left, bottom, angle, zIndex, opacity, compact };
  });
}

function pivotAroundBottom(angleDeg: number): ViewStyle["transform"] {
  return [
    { translateX: CARD_WIDTH / 2 },
    { translateY: CARD_HEIGHT },
    { rotate: `${angleDeg}deg` },
    { translateX: -CARD_WIDTH / 2 },
    { translateY: -CARD_HEIGHT },
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
  const [measuredWidth, setMeasuredWidth] = useState(windowWidth);
  const [scrollOffset, setScrollOffset] = useState(0);

  const layoutWidth = measuredWidth > 0 ? measuredWidth : windowWidth;

  /** Card tapped to focus — expanded and raised until carousel centres it */
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  const step = useMemo(
    () => carouselStep(cards.length, layoutWidth),
    [cards.length, layoutWidth],
  );

  const bounds = useMemo(
    () => scrollBounds(cards.length, layoutWidth, step),
    [cards.length, layoutWidth, step],
  );

  const stripWidth = useMemo(
    () =>
      cards.length === 0
        ? layoutWidth
        : (cards.length - 1) * step + CARD_WIDTH + CENTER_GUTTER * 2,
    [cards.length, layoutWidth, step],
  );

  const focusedIndex = useMemo(
    () => focusedCardIndex(cards.length, layoutWidth, scrollOffset, step),
    [cards.length, layoutWidth, scrollOffset, step],
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
        displayFocusIndex,
      ),
    [cards.length, layoutWidth, scrollOffset, step, displayFocusIndex],
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
    const s = carouselStep(next, w);
    stepRef.current = s;
    const b = scrollBounds(next, w, s);
    boundsRef.current = b;

    if (prev < 0 || next > prev) {
      // Fresh deal or hand grew — open at the low end
      const targetScroll = scrollToCenterCard(0, w, s);
      applyScroll(clampScroll(targetScroll, b.min, b.max));
      anchorRankRef.current = cards[0]?.value ?? null;
      anchorIndexRef.current = 0;
    } else {
      // Card played — stay near the same rank band
      const target = indexAfterPlay(
        cards,
        anchorRankRef.current,
        anchorIndexRef.current,
      );
      const targetScroll = scrollToCenterCard(target, w, s);
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
    const s = stepRef.current;
    const b = boundsRef.current;
    const targetScroll = scrollToCenterCard(target, w, s);
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
      const s = stepRef.current;
      const { min, max } = boundsRef.current;

      // One wheel notch = exactly one card (scroll down → next card to the right)
      const direction = delta > 0 ? 1 : -1;
      const currentIndex = focusedCardIndex(count, w, scrollRef.current, s);
      const nextIndex = Math.max(0, Math.min(count - 1, currentIndex + direction));
      if (nextIndex === currentIndex) return;

      const snapped = clampScroll(scrollToCenterCard(nextIndex, w, s), min, max);
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
      style={styles.handOuter}
      onLayout={onLayout}
      {...(cards.length > 1 ? panResponder.panHandlers : {})}
    >
      <Animated.View
        style={[
          styles.fanStrip,
          {
            width: Math.max(stripWidth, layoutWidth),
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
                  zIndex: isSelected
                    ? 2000 + slot.zIndex
                    : isPressed || index === pendingFocusIndex
                      ? 2500 + index
                      : slot.zIndex,
                  opacity: isSelected ? 1 : slot.opacity,
                  transform: pivotAroundBottom(slot.angle),
                },
              ]}
              onTouchStart={() => setPressedIndex(index)}
              onTouchEnd={() => setPressedIndex(null)}
              onTouchCancel={() => setPressedIndex(null)}
            >
              <Card
                card={card}
                selected={isSelected}
                compact={slot.compact && !isSelected && !isFocused}
                highlight={isPlayable ? (isSelected ? 1 : isFocused ? 0.55 : 0.35) : 0}
                flash={index === startingCardIndex}
                disabled={disabled || !isPlayable}
                onPress={() => handleCardPress(index)}
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
    height: HAND_FAN_HEIGHT,
    overflow: "visible",
  },
  fanStrip: {
    position: "absolute",
    left: 0,
    bottom: FAN_BOTTOM_PADDING,
    height: CARD_HEIGHT + FAN_HEADROOM,
  },
  cardSlot: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
});
