import WebSocket from 'ws';
import { sleep } from './metrics';
import { MessageType, parseMessage, serializeMessage, createMessageId } from '../../server/typescript/src/websocket/protocol';

export interface PerfClientOptions {
  serverUrl: string;
  clientId?: string;
  token?: string;
  documentId?: string;
}

export interface DeltaMessage {
  type: MessageType.DELTA;
  id: string;
  timestamp: number;
  documentId: string;
  delta: Record<string, unknown>;
  vectorClock: Record<string, number>;
}

export type IncomingMessage =
  | { type: MessageType.PING; id: string; timestamp: number }
  | { type: MessageType.AUTH_SUCCESS; id: string; timestamp: number; userId: string }
  | { type: MessageType.AUTH_ERROR; id: string; timestamp: number; error: string }
  | { type: MessageType.SYNC_RESPONSE; id: string; timestamp: number; documentId: string; state?: any }
  | DeltaMessage
  | { type: string; id?: string; timestamp?: number; [key: string]: any };

const DEFAULT_WS_PATH = '/ws';

function toWebSocketUrl(serverUrl: string): string {
  if (serverUrl.startsWith('ws://') || serverUrl.startsWith('wss://')) {
    return serverUrl;
  }
  const trimmed = serverUrl.replace(/\/$/, '');
  return trimmed.replace(/^http/, 'ws') + DEFAULT_WS_PATH;
}

export class PerfClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private readonly serverUrl: string;
  private readonly token?: string;
  private readonly clientId: string;
  private readonly deltaHandlers: Array<(message: DeltaMessage) => void> = [];

  constructor(options: PerfClientOptions) {
    this.serverUrl = options.serverUrl;
    this.token = options.token;
    this.clientId = options.clientId ?? `perf-client-${createMessageId()}`;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const wsUrl = toWebSocketUrl(this.serverUrl);
    this.ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.ws?.on('open', () => {
          this.connected = true;
          this.send({
            type: MessageType.AUTH,
            id: createMessageId(),
            timestamp: Date.now(),
            token: this.token,
          });
        });

      this.ws?.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.ws?.on('close', () => {
        this.connected = false;
      });

      this.ws?.on('message', (data: Buffer | string) => {
        const message = parseMessage(data);
        if (!message) return;

        if (message.type === MessageType.PING) {
          this.send({
            type: MessageType.PONG,
            id: createMessageId(),
            timestamp: Date.now(),
          });
          return;
        }

        if (message.type === MessageType.AUTH_SUCCESS) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        if (message.type === MessageType.AUTH_ERROR) {
          clearTimeout(timeout);
          reject(new Error((message as any).error || 'Auth error'));
          return;
        }

        if (message.type === MessageType.DELTA) {
          this.deltaHandlers.forEach(handler => handler(message as DeltaMessage));
        }
      });
    });
  }

  async sync(documentId: string): Promise<void> {
    this.send({
      type: MessageType.SYNC_REQUEST,
      id: createMessageId(),
      timestamp: Date.now(),
      documentId,
    });

    await sleep(50);
  }

  async sendDelta(documentId: string, delta: Record<string, unknown>): Promise<void> {
    this.send({
      type: MessageType.DELTA,
      id: createMessageId(),
      timestamp: Date.now(),
      documentId,
      delta,
      vectorClock: {},
    });
  }

  onDelta(handler: (message: DeltaMessage) => void): void {
    this.deltaHandlers.push(handler);
  }

  async disconnect(): Promise<void> {
    if (!this.ws) return;
    this.ws.close();
    this.ws = null;
    this.connected = false;
  }

  private send(message: Record<string, unknown>): void {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected');
    }
    const encoded = serializeMessage(message as any, true);
    this.ws.send(encoded);
  }

  get id(): string {
    return this.clientId;
  }
}

export async function createClients(count: number, serverUrl: string): Promise<PerfClient[]> {
  const clients: PerfClient[] = [];
  for (let i = 0; i < count; i += 1) {
    const client = new PerfClient({ serverUrl });
    clients.push(client);
  }
  return clients;
}

export async function connectClients(clients: PerfClient[], batchSize: number = 200): Promise<void> {
  for (let i = 0; i < clients.length; i += batchSize) {
    const batch = clients.slice(i, i + batchSize);
    await Promise.all(batch.map(client => client.connect()));
  }
}

export async function disconnectClients(clients: PerfClient[]): Promise<void> {
  await Promise.all(clients.map(client => client.disconnect()));
}
