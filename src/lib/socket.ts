import { io as socketIO, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => {
  if (typeof window === 'undefined') return null;

  if (!socket) {
    // Connects to the same host/port serving the page
    socket = socketIO();
  }
  return socket;
};
