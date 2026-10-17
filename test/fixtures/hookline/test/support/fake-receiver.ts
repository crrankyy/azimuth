import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

export interface ReceivedRequest {
  headers: IncomingHttpHeaders;
  body: string;
}

/** A local HTTP receiver, so unit tests never call real endpoints. */
export async function fakeReceiver(status = 200, options: { delayMs?: number; body?: string } = {}) {
  const received: ReceivedRequest[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      setTimeout(() => res.writeHead(status).end(options.body ?? ""), options.delayMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/hook`, received, close: () => server.close() };
}
