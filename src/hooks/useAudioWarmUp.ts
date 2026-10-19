import { useEffect } from "react";

export const useAudioWarmUp = (unlockAudio: () => Promise<void>) => {
  useEffect(() => {
    const warm = () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      void unlockAudio();
    };
    const opts = { capture: true, once: true } as AddEventListenerOptions;
    const doc = typeof document !== "undefined" ? document : null;
    doc?.addEventListener("pointerdown", warm, opts);
    doc?.addEventListener("touchstart", warm, opts);
    doc?.addEventListener("keydown", warm, opts);
    return () => {
      doc?.removeEventListener("pointerdown", warm, true);
      doc?.removeEventListener("touchstart", warm, true);
      doc?.removeEventListener("keydown", warm, true);
    };
  }, [unlockAudio]);
};
