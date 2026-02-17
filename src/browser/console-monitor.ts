import type CDP from 'chrome-remote-interface';

export interface ConsoleEntry {
  level: string;
  text: string;
  timestamp: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => void;
type EventEmitterLike = { off: (event: string, fn: AnyFn) => void };

export function createConsoleMonitor(client: CDP.Client) {
  const entries: ConsoleEntry[] = [];

  const onConsole = (params: {
    type: string;
    args: Array<{ value?: unknown; description?: string }>;
    timestamp: number;
  }) => {
    const text = params.args.map((a) => String(a.value ?? a.description ?? '')).join(' ');
    entries.push({
      level: params.type,
      text,
      timestamp: params.timestamp,
    });
  };

  // Use a generic handler since CDP types are strict about event params
  const onException = (params: unknown) => {
    const p = params as { exceptionDetails?: { text?: string; timestamp?: number } };
    if (p.exceptionDetails) {
      entries.push({
        level: 'error',
        text: p.exceptionDetails.text ?? 'Unknown exception',
        timestamp: p.exceptionDetails.timestamp ?? Date.now(),
      });
    }
  };

  client.on('Runtime.consoleAPICalled', onConsole);
  client.on('Runtime.exceptionThrown', onException);

  return {
    getEntries: () => [...entries],
    getErrors: () => entries.filter((e) => e.level === 'error'),
    clear: () => {
      entries.length = 0;
    },
    stop: () => {
      const emitter = client as unknown as EventEmitterLike;
      emitter.off('Runtime.consoleAPICalled', onConsole);
      emitter.off('Runtime.exceptionThrown', onException);
    },
  };
}
