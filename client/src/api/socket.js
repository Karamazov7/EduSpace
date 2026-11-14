import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const socket = io();

// Runs `fn` whenever the server says room availability changed (FR-047).
export function useRefreshOnChange(fn) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    const handler = () => latest.current();
    socket.on('availability:changed', handler);
    return () => socket.off('availability:changed', handler);
  }, []);
}
