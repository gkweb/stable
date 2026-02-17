import type CDP from 'chrome-remote-interface';
import type { ElementRef } from './snapshot.js';
import { BrowserError } from '../shared/errors.js';
import { waitForNetworkIdle } from './index.js';

async function resolveNodePosition(
  client: CDP.Client,
  ref: ElementRef,
): Promise<{ x: number; y: number }> {
  // Resolve backend node to a remote object
  const { object } = await client.DOM.resolveNode({
    backendNodeId: ref.backendNodeId,
  });

  if (!object.objectId) {
    throw new BrowserError(`Cannot resolve element ${ref.ref}`);
  }

  // Get the bounding box via JS
  const { result } = await client.Runtime.callFunctionOn({
    objectId: object.objectId,
    functionDeclaration: `function() {
      const rect = this.getBoundingClientRect();
      return JSON.stringify({
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        width: rect.width,
        height: rect.height
      });
    }`,
    returnByValue: true,
  });

  const box = JSON.parse(String(result.value)) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  if (box.width === 0 && box.height === 0) {
    throw new BrowserError(`Element ${ref.ref} has zero dimensions (not visible)`);
  }

  return { x: box.x, y: box.y };
}

export async function clickElement(client: CDP.Client, ref: ElementRef): Promise<void> {
  const { x, y } = await resolveNodePosition(client, ref);

  await client.Input.dispatchMouseEvent({
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await client.Input.dispatchMouseEvent({
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });

  await waitForNetworkIdle(client, 3000);
}

export async function fillElement(
  client: CDP.Client,
  ref: ElementRef,
  text: string,
): Promise<void> {
  // Focus the element
  await client.DOM.focus({ backendNodeId: ref.backendNodeId });

  // Clear existing content
  await client.Input.dispatchKeyEvent({
    type: 'keyDown',
    key: 'a',
    code: 'KeyA',
    commands: ['selectAll'],
  });
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'a', code: 'KeyA' });

  // Type the new text character by character
  for (const char of text) {
    await client.Input.dispatchKeyEvent({ type: 'keyDown', text: char });
    await client.Input.dispatchKeyEvent({ type: 'keyUp', text: char });
  }
}

export async function selectElement(
  client: CDP.Client,
  ref: ElementRef,
  value: string,
): Promise<void> {
  const { object } = await client.DOM.resolveNode({
    backendNodeId: ref.backendNodeId,
  });

  if (!object.objectId) {
    throw new BrowserError(`Cannot resolve element ${ref.ref}`);
  }

  await client.Runtime.callFunctionOn({
    objectId: object.objectId,
    functionDeclaration: `function(val) {
      this.value = val;
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }`,
    arguments: [{ value }],
  });
}

export async function scrollPage(
  client: CDP.Client,
  direction: 'up' | 'down' | 'left' | 'right',
  amount = 400,
): Promise<void> {
  const deltaX = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
  const deltaY = direction === 'up' ? -amount : direction === 'down' ? amount : 0;

  await client.Input.dispatchMouseEvent({
    type: 'mouseWheel',
    x: 640,
    y: 360,
    deltaX,
    deltaY,
  });

  // Wait for scroll to settle
  await new Promise((resolve) => setTimeout(resolve, 300));
}

export async function pressKey(client: CDP.Client, key: string): Promise<void> {
  await client.Input.dispatchKeyEvent({ type: 'keyDown', key });
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key });
}
