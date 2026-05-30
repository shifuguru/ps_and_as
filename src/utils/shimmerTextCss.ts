/** Shimmer text styling — keep CSS in sync with web-shell.css / webShellCssContent.ts */
export const PS_SHIMMER_TEXT_CLASS = "ps-shimmer-text";

export const PS_SHIMMER_TEXT_CSS = `
.ps-shimmer-text {
  display: inline-block;
  background-repeat: no-repeat;
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  background-image: linear-gradient(
    90deg,
    var(--shimmer-base) 0%,
    var(--shimmer-base) 38%,
    var(--shimmer-soft) 44%,
    var(--shimmer-mid) 48%,
    var(--shimmer-hot) 50%,
    var(--shimmer-mid) 52%,
    var(--shimmer-soft) 56%,
    var(--shimmer-base) 62%,
    var(--shimmer-base) 100%
  );
  animation-name: ps-shimmer-text-sweep;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
@keyframes ps-shimmer-text-sweep {
  0% {
    background-position: 130% 50%;
  }
  12% {
    background-position: -30% 50%;
  }
  100% {
    background-position: -30% 50%;
  }
}
`;
