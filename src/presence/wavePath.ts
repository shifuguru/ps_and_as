/** Closed SVG path for a sinusoidal ring — static shape, rotate wrapper for motion. */
export function buildPresenceWavePath(
  size: number,
  amplitudePx: number,
  lobeCount: number,
  segments = 72,
): string {
  if (amplitudePx <= 0 || size <= 0) return "";

  const cx = size / 2;
  const cy = size / 2;
  const baseR = size / 2 - 3;
  const parts: string[] = [];

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = baseR + amplitudePx * Math.sin(lobeCount * theta);
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return `${parts.join(" ")} Z`;
}
