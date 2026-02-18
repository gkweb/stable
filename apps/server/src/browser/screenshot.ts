import type CDP from 'chrome-remote-interface';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function captureScreenshot(client: CDP.Client, savePath?: string): Promise<Buffer> {
  const { data } = await client.Page.captureScreenshot({ format: 'png' });
  const buffer = Buffer.from(data, 'base64');

  if (savePath) {
    await mkdir(dirname(savePath), { recursive: true });
    await writeFile(savePath, buffer);
  }

  return buffer;
}
