import { useEffect } from "react";

let lockCount = 0;
let savedStyles;
let savedScrollY;

export default function useModalScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      savedStyles = {
        bodyPosition: document.body.style.position,
        bodyTop: document.body.style.top,
        bodyWidth: document.body.style.width,
        bodyOverflow: document.body.style.overflow,
        htmlOverflow: document.documentElement.style.overflow,
      };
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.position = savedStyles.bodyPosition;
        document.body.style.top = savedStyles.bodyTop;
        document.body.style.width = savedStyles.bodyWidth;
        document.body.style.overflow = savedStyles.bodyOverflow;
        document.documentElement.style.overflow = savedStyles.htmlOverflow;
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [enabled]);
}
