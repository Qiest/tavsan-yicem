import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

interface Counter {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function useLoveCounter() {
  const [counter, setCounter] = useState<Counter>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const ANNIVERSARY = new Date('2026-01-28T00:00:00Z');

    const tick = () => {
      const now   = new Date();
      const diff  = Math.max(0, now.getTime() - ANNIVERSARY.getTime());
      const total = Math.floor(diff / 1000);
      setCounter({
        days:    Math.floor(total / 86400),
        hours:   Math.floor((total % 86400) / 3600),
        minutes: Math.floor((total % 3600)  / 60),
        seconds: total % 60,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return counter;
}
