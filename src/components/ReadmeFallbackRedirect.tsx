import { useEffect } from "react";
import { redirectToReadmeFallback } from "../utils/readmeFallback";

/** Web crash path — hand off to readme-fallback.html (loads real README.md). */
export default function ReadmeFallbackRedirect() {
  useEffect(() => {
    redirectToReadmeFallback();
  }, []);
  return null;
}
