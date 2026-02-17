import type CDP from 'chrome-remote-interface';

export interface NetworkEntry {
  url: string;
  method: string;
  status?: number;
  type?: string;
  timestamp: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => void;
type EventEmitterLike = { off: (event: string, fn: AnyFn) => void };

export function createNetworkMonitor(client: CDP.Client) {
  const entries: NetworkEntry[] = [];
  const pending = new Map<string, NetworkEntry>();

  const onRequest = (params: {
    requestId: string;
    request: { url: string; method: string };
    type?: string;
    timestamp: number;
  }) => {
    const entry: NetworkEntry = {
      url: params.request.url,
      method: params.request.method,
      type: params.type,
      timestamp: params.timestamp,
    };
    pending.set(params.requestId, entry);
  };

  const onResponse = (params: { requestId: string; response: { status: number } }) => {
    const entry = pending.get(params.requestId);
    if (entry) {
      entry.status = params.response.status;
      entries.push(entry);
      pending.delete(params.requestId);
    }
  };

  client.on('Network.requestWillBeSent', onRequest);
  client.on('Network.responseReceived', onResponse);

  return {
    getEntries: () => [...entries],
    clear: () => {
      entries.length = 0;
      pending.clear();
    },
    stop: () => {
      const emitter = client as unknown as EventEmitterLike;
      emitter.off('Network.requestWillBeSent', onRequest);
      emitter.off('Network.responseReceived', onResponse);
    },
  };
}
