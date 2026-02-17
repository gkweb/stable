import CDP from 'chrome-remote-interface';
import { spawn, type ChildProcess } from 'node:child_process';
import { getConfig } from '../config/index.js';
import type { Logger } from '../shared/logger.js';
import { BrowserError } from '../shared/errors.js';

export interface BrowserSession {
  client: CDP.Client;
  close: () => Promise<void>;
}

let chromiumProcess: ChildProcess | null = null;

function findChromium(): string {
  const config = getConfig();
  if (config.chromiumPath) return config.chromiumPath;

  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];

  // In Docker, chromium-browser is typically available
  // For local dev, try common paths
  for (const path of candidates) {
    try {
      const { execSync } = require('node:child_process') as typeof import('node:child_process');
      execSync(`test -f "${path}"`, { stdio: 'ignore' });
      return path;
    } catch {
      // try next
    }
  }

  // Fallback: assume it's on PATH
  return 'chromium-browser';
}

export async function launchBrowser(logger: Logger): Promise<BrowserSession> {
  const config = getConfig();
  const chromiumPath = findChromium();

  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--no-first-run',
    `--window-size=${config.browserViewportWidth},${config.browserViewportHeight}`,
    '--remote-debugging-port=0', // Let OS pick port
  ];

  logger.info({ chromiumPath }, 'Launching Chromium');

  chromiumProcess = spawn(chromiumPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Extract the debugging port from stderr
  const port = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new BrowserError('Chromium launch timeout')), 15000);

    chromiumProcess!.stderr?.on('data', (data: Buffer) => {
      const match = data.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);
      if (match?.[1]) {
        clearTimeout(timeout);
        resolve(parseInt(match[1], 10));
      }
    });

    chromiumProcess!.on('error', (err) => {
      clearTimeout(timeout);
      reject(new BrowserError(`Failed to launch Chromium: ${err.message}`));
    });

    chromiumProcess!.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== null && code !== 0) {
        reject(new BrowserError(`Chromium exited with code ${code}`));
      }
    });
  });

  logger.info({ port }, 'Chromium ready, connecting via CDP');

  const client = await CDP({ port });

  // Enable required domains
  await Promise.all([
    client.Page.enable(),
    client.DOM.enable(),
    client.Runtime.enable(),
    client.Network.enable(),
    client.Accessibility.enable(),
  ]);

  // Set viewport
  await client.Emulation.setDeviceMetricsOverride({
    width: config.browserViewportWidth,
    height: config.browserViewportHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });

  return {
    client,
    close: async () => {
      try {
        await client.close();
      } catch {
        // ignore
      }
      if (chromiumProcess) {
        chromiumProcess.kill('SIGTERM');
        chromiumProcess = null;
      }
    },
  };
}

export async function navigateTo(client: CDP.Client, url: string, logger: Logger): Promise<void> {
  logger.debug({ url }, 'Navigating to URL');
  await client.Page.navigate({ url });
  await client.Page.loadEventFired();
  // Wait a bit for any post-load JS to settle
  await new Promise((resolve) => setTimeout(resolve, 500));
}

export async function waitForNetworkIdle(client: CDP.Client, timeoutMs = 5000): Promise<void> {
  let pendingRequests = 0;

  const onRequest = () => {
    pendingRequests++;
  };
  const onResponse = () => {
    pendingRequests = Math.max(0, pendingRequests - 1);
  };

  client.on('Network.requestWillBeSent', onRequest);
  client.on('Network.loadingFinished', onResponse);
  client.on('Network.loadingFailed', onResponse);

  try {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (pendingRequests === 0) return;
    }
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emitter = client as any;
    emitter.off('Network.requestWillBeSent', onRequest);
    emitter.off('Network.loadingFinished', onResponse);
    emitter.off('Network.loadingFailed', onResponse);
  }
}
