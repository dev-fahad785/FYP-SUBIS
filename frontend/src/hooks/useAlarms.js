import { useEffect, useRef, useState } from 'react';

export function useAlarms(buses) {
  const audioRef = useRef(null);
  const [armedBuses, setArmedBuses] = useState({});
  const [activeAlarms, setActiveAlarms] = useState({});
  const [mutedBuses, setMutedBuses] = useState({});

  useEffect(() => {
    try {
      audioRef.current = new Audio('/alarm.mp3');
      audioRef.current.loop = true;
    } catch (e) {
      console.warn('Alarm audio unavailable', e);
    }
  }, []);

  useEffect(() => {
    const armedIds = Object.keys(armedBuses);
    if (!armedIds.length) return;

    for (const busId of armedIds) {
      const startStopName = (armedBuses[busId] || '').toLowerCase().trim();
      const liveBus = buses[busId];
      if (!liveBus || !Array.isArray(liveBus.etas)) continue;

      const etas = liveBus.etas;
      const startIndex = etas.findIndex(
        (eta) => eta.stopName?.toLowerCase().trim() === startStopName,
      );
      if (startIndex <= 0) continue;

      const prevEta = etas[startIndex - 1];
      const prevStopName = prevEta?.stopName?.toLowerCase().trim() || '';
      const isAtPrevStop =
        (liveBus.currentStop || '').toLowerCase().trim() === prevStopName ||
        (liveBus.nearestStop || '').toLowerCase().trim() === prevStopName;
      const prevMinutes =
        typeof prevEta?.estimatedMinutes === 'number' ? prevEta.estimatedMinutes : null;
      const shouldTrigger = isAtPrevStop || (prevMinutes !== null && prevMinutes <= 1);

      if (shouldTrigger && !activeAlarms[busId] && !mutedBuses[busId]) {
        try {
          audioRef.current?.play().catch(() => null);
        } catch {}
        setActiveAlarms((c) => ({ ...c, [busId]: true }));
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('SUBIS bus alert', {
            body: `Bus ${liveBus.plateNumber || liveBus.busId} is approaching your start stop.`,
          });
        }
      }

      if (!shouldTrigger && mutedBuses[busId]) {
        setMutedBuses((current) => {
          const next = { ...current };
          delete next[busId];
          return next;
        });
      }
    }
  }, [buses, armedBuses, activeAlarms, mutedBuses]);

  const toggleArmForBus = (bus, searchStartStop) => {
    const busId = bus?.busId || bus?.id || '';
    if (!busId) return;

    const isArmed = Boolean(armedBuses[busId]);
    setArmedBuses((current) => {
      const next = { ...current };
      if (isArmed) {
        delete next[busId];
      } else if (searchStartStop?.trim()) {
        next[busId] = searchStartStop.trim();
      } else {
        next[busId] = (bus.currentStop || '').trim();
      }
      return next;
    });

    if (isArmed) {
      setMutedBuses((current) => {
        const next = { ...current };
        delete next[busId];
        return next;
      });
      setActiveAlarms((current) => {
        const next = { ...current };
        delete next[busId];
        return next;
      });
    }
  };

  const stopAlarm = (busId) => {
    setActiveAlarms((c) => {
      const next = { ...c };
      delete next[busId];
      return next;
    });
    setMutedBuses((current) => ({
      ...current,
      [busId]: true,
    }));
    try {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    } catch {}
  };

  return { armedBuses, activeAlarms, toggleArmForBus, stopAlarm };
}
