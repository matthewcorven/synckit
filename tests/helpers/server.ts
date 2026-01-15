import { sleep } from './metrics';

export type ServerType = 'typescript' | 'csharp';

export function getServerType(): ServerType {
  const type = (process.env.SERVER_TYPE || 'typescript').toLowerCase();
  return type === 'csharp' ? 'csharp' : 'typescript';
}

export function getServerPort(): number {
  if (process.env.SERVER_PORT) {
    return Number(process.env.SERVER_PORT);
  }
  return getServerType() === 'csharp' ? 8090 : 8080;
}

export function getServerUrl(): string {
  const host = process.env.SERVER_HOST || 'localhost';
  return `http://${host}:${getServerPort()}`;
}

export function getWebSocketUrl(): string {
  return `${getServerUrl().replace(/^http/, 'ws')}/ws`;
}

export async function waitForHealth(timeoutMs: number = 10000): Promise<void> {
  const start = Date.now();
  const url = `${getServerUrl()}/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // ignore
    }
    await sleep(200);
  }
  throw new Error(`Server not healthy after ${timeoutMs}ms`);
}
