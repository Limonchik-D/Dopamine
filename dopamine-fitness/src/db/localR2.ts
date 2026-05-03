import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppR2 } from "../types/index.js";

const UPLOAD_DIR = path.resolve(process.cwd(), ".uploads");

/**
 * Local filesystem R2 shim for Node.js development.
 * Stores files under .uploads/ directory.
 */
export class LocalR2 implements AppR2 {
  async put(
    key: string,
    value: ArrayBuffer,
    opts?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }
  ): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, key.replace(/\//g, path.sep));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(value));

    if (opts?.httpMetadata?.contentType) {
      await fs.writeFile(filePath + ".meta", JSON.stringify(opts.httpMetadata));
    }
  }

  async get(key: string): Promise<{
    body: ReadableStream;
    writeHttpMetadata(headers: Headers): void;
  } | null> {
    const filePath = path.join(UPLOAD_DIR, key.replace(/\//g, path.sep));
    try {
      const buffer = await fs.readFile(filePath);
      let contentType = "application/octet-stream";

      try {
        const meta = await fs.readFile(filePath + ".meta", "utf-8");
        contentType = (JSON.parse(meta) as { contentType?: string }).contentType ?? contentType;
      } catch {
        // no meta file, use default
      }

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(buffer));
          controller.close();
        },
      });

      const ct = contentType;
      return {
        body: stream,
        writeHttpMetadata(headers: Headers) {
          headers.set("Content-Type", ct);
        },
      };
    } catch {
      return null;
    }
  }
}
