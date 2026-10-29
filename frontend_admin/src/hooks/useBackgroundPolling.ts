import { useEffect, useRef } from 'react';

export const BACKGROUND_REFRESH_INTERVAL = 30_000;

// 串行调度，后台标签页继续刷新；返回前台时立即补取。
export function useBackgroundPolling(
  task: (signal: AbortSignal) => Promise<void>,
  enabled: boolean,
  key: string,
) {
  const taskRef = useRef(task);
  taskRef.current = task;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let running = false;
    const tick = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        await taskRef.current(controller.signal);
      } catch {
        // 调用方展示错误，下一轮继续刷新。
      } finally {
        running = false;
        if (!controller.signal.aborted)
          timer = setTimeout(tick, BACKGROUND_REFRESH_INTERVAL);
      }
    };
    const refreshOnVisible = () => {
      if (document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      void tick();
    };
    void tick();
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [enabled, key]);
}
