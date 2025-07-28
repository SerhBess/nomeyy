import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { S } from "node_modules/@upstash/redis/zmscore-DzNHSWxc.mjs";

const encoder = new TextEncoder();

type EventPayload = Record<string, unknown>;

type SSEClient = {
  id: string;
  userId: string | null;
  ip: string;
  send: (event: string, data: EventPayload) => void;
  close: () => void;
};

const clients = new Set<SSEClient>();

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const userId = token?.sub ?? null;

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const id = Date.now().toString();

      const send = (event: string, data: EventPayload) => {
        const formatted = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(formatted));
      };

      const client: SSEClient = {
        id,
        userId,
        ip,
        send,
        close: () => controller.close(),
      };

      clients.add(client);
      console.log(
        `[SSE] Client ${id} (${ip}) connected. Total: ${clients.size}`,
      );

      broadcast("connected", { ip });

      const interval = setInterval(() => send("ping", {}), 8000);
      let message = 0;

      const sendMessage = setInterval(() => {
        send("message", { message });
        message++;
      }, 5000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(sendMessage);
        clients.delete(client);
        console.log(
          `[SSE] Client ${id} (${ip}) disconnected. Total: ${clients.size}`,
        );
        broadcast("client-disconnected", { ip });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export function broadcast<T extends EventPayload>(event: string, data: T) {
  console.log(`Broadcasting event: ${event} : ${JSON.stringify(data)}`);
  for (const client of clients) {
    client.send(event, data);
  }
}
