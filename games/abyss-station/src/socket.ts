import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient } from '../shared/protocol';

// Same origin in both dev (Vite proxies /socket.io) and production.
export const socket: Socket<ServerToClient, ClientToServer> = io();
