import { useCallback, useEffect, useState } from 'react';

export const SMS_CODE_COUNTDOWN_SECONDS = 60;

export function useSmsCodeCountdown(initialSeconds = 0) {
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.max(0, Math.floor(initialSeconds)),
  );
  const isActive = remainingSeconds > 0;

  useEffect(() => {
    if (!isActive) return undefined;

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const start = useCallback((seconds = SMS_CODE_COUNTDOWN_SECONDS) => {
    setRemainingSeconds(Math.max(0, Math.floor(seconds)));
  }, []);

  return {
    isActive,
    remainingSeconds,
    start,
  };
}
