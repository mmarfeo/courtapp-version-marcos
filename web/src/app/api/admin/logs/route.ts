import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const dynamic = 'force-dynamic';

function getLogPath(): string | null {
  const candidates = [
    path.join(os.homedir(), '.pm2', 'logs', 'courtup-marcos-out.log'),
    path.join(os.homedir(), '.pm2', 'logs', 'courtup-out.log'),
    '/root/.pm2/logs/courtup-marcos-out.log',
    '/root/.pm2/logs/courtup-out.log',
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function readTail(filePath: string, lines: number): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  const split = content.split('\n');
  return split.slice(Math.max(0, split.length - lines)).join('\n');
}

export async function GET(req: NextRequest) {
  const logPath = getLogPath();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      if (!logPath) {
        send('[ERROR] No se encontró el archivo de logs de PM2.');
        controller.close();
        return;
      }

      // Send last 100 lines immediately
      try {
        send(readTail(logPath, 100));
      } catch {
        send('[ERROR] No se pudo leer el archivo de logs.');
      }

      // Watch for new content
      let lastSize = fs.statSync(logPath).size;
      const interval = setInterval(() => {
        try {
          const stat = fs.statSync(logPath);
          if (stat.size > lastSize) {
            const fd = fs.openSync(logPath, 'r');
            const buf = Buffer.alloc(stat.size - lastSize);
            fs.readSync(fd, buf, 0, buf.length, lastSize);
            fs.closeSync(fd);
            lastSize = stat.size;
            const newContent = buf.toString('utf-8');
            if (newContent.trim()) send(newContent);
          }
        } catch {
          // file rotated or deleted
        }
      }, 1000);

      // Stop after 10 minutes
      const timeout = setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 600_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearTimeout(timeout);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
