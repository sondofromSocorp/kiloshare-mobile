import { useState, useEffect, useCallback } from 'react';
import { getUnreadCount } from '../lib/chat';

export function useUnreadMessages(userId: string | undefined) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    try {
      const total = await getUnreadCount(userId);
      setCount(total);
    } catch {
      // Silently fail
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, refresh };
}
