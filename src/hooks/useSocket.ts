import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const s = Capacitor.isNativePlatform() ? io(backendUrl) : io();
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  return socket;
};
