import { Server } from 'socket.io';

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL } });
  return io;
}

// Events carry no private data: they only tell clients "something changed, refetch".
export function broadcast(event, payload = {}) {
  io?.emit(event, payload);
}
