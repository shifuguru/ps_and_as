/** Web scrollbar styling — keep CSS in sync with web-shell.css / webShellCssContent.ts */
export const PS_THEMED_SCROLLBAR_CLASS = "ps-themed-scrollbar";

export const PS_THEMED_SCROLLBAR_CSS = `
.ps-themed-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--scroll-thumb, #5b9fd4) var(--scroll-track, rgba(255, 255, 255, 0.08));
}
.ps-themed-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.ps-themed-scrollbar::-webkit-scrollbar-track {
  background: var(--scroll-track, rgba(255, 255, 255, 0.08));
  border-radius: 999px;
  margin: 6px 0;
}
.ps-themed-scrollbar::-webkit-scrollbar-thumb {
  background: var(--scroll-thumb, #5b9fd4);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.ps-themed-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--scroll-thumb-hover, var(--scroll-thumb, #5b9fd4));
}
`;
