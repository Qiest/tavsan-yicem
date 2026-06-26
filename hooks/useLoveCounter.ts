import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config/api';

interface Counter {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const DEFAULT_ANNIVERSARY = '2026-01-28T00:00:00Z';

export function useLoveCounter() {
  const [counter,   setCounter]   = useState<Counter>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [startDate, setStartDate] = useState<Date | null>(null);

  // Backend'den başlangıç tarihini çek — ikisi de aynı tarihi görsün
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/api/counter/start`);
        const data = await res.json();
        setStartDate(new Date(data.startDate || DEFAULT_ANNIVERSARY));
      } catch {
        setStartDate(new Date(DEFAULT_ANNIVERSARY));
      }
    })();
  }, []);

  // Sayacı çalıştır
  useEffect(() => {
    if (!startDate) return;
    const tick = () => {
      const now   = new Date();
      const diff  = Math.max(0, now.getTime() - startDate.getTime());
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
  }, [startDate]);

  // Sıfırla — backend'e yaz, ikisi de sıfırlanır
  const resetCounter = useCallback(async (role: string = 'user') => {
    const now = new Date();
    try {
      await fetch(`${API_BASE}/api/counter/reset`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ startDate: now.toISOString(), role }),
      });
    } catch (e) {
      console.warn('Counter reset error:', e);
    }
    setStartDate(now);
  }, []);

  return { counter, resetCounter };
}
