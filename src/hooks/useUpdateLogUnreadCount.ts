import { useCallback, useEffect, useState } from "react";
import {
  getUpdateLogUnreadCount,
  markUpdateLogSeen as persistUpdateLogSeen,
} from "../services/updateLogSeen";

export function useUpdateLogUnreadCount(menuVisible: boolean, updateLogOpen: boolean) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const next = await getUpdateLogUnreadCount();
    setCount(next);
  }, []);

  useEffect(() => {
    if (menuVisible && !updateLogOpen) {
      void refresh();
    }
  }, [menuVisible, updateLogOpen, refresh]);

  const markSeen = useCallback(async () => {
    await persistUpdateLogSeen();
    setCount(0);
  }, []);

  return { count, refresh, markSeen };
}
