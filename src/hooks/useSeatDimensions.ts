import { useMemo } from "react";
import { computeSeatDimensions, type SeatDimensions } from "../utils/seatDimensions";
import { useResponsiveDimensions } from "../utils/responsive";

export function useSeatDimensions(overrideWidth?: number): SeatDimensions {
  const { width, height } = useResponsiveDimensions();
  const basis = overrideWidth ?? width;
  return useMemo(
    () => computeSeatDimensions(basis, height, height),
    [basis, height],
  );
}
