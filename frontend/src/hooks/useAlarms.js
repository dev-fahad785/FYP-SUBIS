import { useEffect, useRef, useState } from 'react';

export function useAlarms(buses) {
  const audioRef = useRef(null);
  const [armedBuses, setArmedBuses] = useState({});
  const [activeAlarms, setActiveAlarms] = useState({});

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

      if (shouldTrigger && !activeAlarms[busId]) {
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
    }
  }, [buses, armedBuses, activeAlarms]);

  const toggleArmForBus = (bus, searchStartStop) => {
    const busId = bus?.busId || bus?.id || '';
    if (!busId) return;
    setArmedBuses((current) => {
      const next = { ...current };
      if (next[busId]) {
        delete next[busId];
      } else if (searchStartStop?.trim()) {
        next[busId] = searchStartStop.trim();
      } else {
        next[busId] = (bus.currentStop || '').trim();
      }
      return next;
    });
  };

  const stopAlarm = (busId) => {
    setActiveAlarms((c) => {
      const next = { ...c };
      delete next[busId];
      return next;
    });
    try {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    } catch {}
  };

  return { armedBuses, activeAlarms, toggleArmForBus, stopAlarm };
}
