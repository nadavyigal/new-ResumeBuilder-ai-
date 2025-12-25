"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  start?: number;
  className?: string;
}

export function CountUp({ end, duration = 1.8, start = 0, className }: CountUpProps) {
  const [value, setValue] = useState(start);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const startTime = performance.now();
    const range = end - start;

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const nextValue = Math.round(start + range * progress);
      setValue(nextValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [end, duration, start]);

  return <span className={className}>{value}</span>;
}
