import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const NOTIFICATION_UPDATE_EVENT = 'notification-update';

/**
 * Get socket server URL: same origin in dev (Vite proxies /socket.io to backend), or from env.
 */
function getSocketUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    try {
      return new URL(import.meta.env.VITE_API_BASE_URL).origin;
    } catch (_) {}
  }
  return window.location.origin;
}

/**
 * Connect to backend Socket.IO and emit a custom event when server sends 'notification-update'.
 * Use this in the salesman dashboard layout so one connection is shared.
 * Listen for 'notification-update' on window to refresh count/list.
 */
export function useNotificationSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) return;

    const url = getSocketUrl();
    const socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('notification-update', () => {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_UPDATE_EVENT));
    });

    socket.on('connect_error', () => {
      // Silent: fallback to polling in useNotificationCount; reconnect will retry
    });
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') socket.connect();
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { socket: socketRef.current };
}

export { NOTIFICATION_UPDATE_EVENT };
