"use client";

import { useEffect, useState } from "react";

type IpEventPayload = { ip: string };
type MessagePayload = { message: string };

type EventMessage =
  | { type: "Connected"; data: IpEventPayload }
  | { type: "New client connected"; data: IpEventPayload }
  | { type: "Client disconnected"; data: IpEventPayload }
  | { type: "Message"; data: MessagePayload };

export const SseListener = () => {
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ev = new EventSource("/api/sse");

    const pushMessage = (message: EventMessage) => {
      setMessages((prev) => [message, ...prev.slice(0, 1)]);
    };

    ev.addEventListener("connected", (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as IpEventPayload;
        pushMessage({ type: "Connected", data });
      } catch (err) {
        console.error("Invalid JSON in connected", err);
        setError("Invalid JSON in connected");
      }
    });

    ev.addEventListener(
      "client-disconnected",
      (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as IpEventPayload;
          pushMessage({ type: "Client disconnected", data });
        } catch (err) {
          console.error("Invalid JSON in client-disconnected", err);
          setError("Invalid JSON in client-disconnected");
        }
      },
    );

    ev.addEventListener("message", (event: MessageEvent<string>) => {
      console.log("Message event received:", event.data);
      try {
        const data = JSON.parse(event.data) as MessagePayload;
        pushMessage({ type: "Message", data });
      } catch (err) {
        console.error("Invalid JSON in message", err);
        setError("Invalid JSON in message");
      }
    });

    ev.onerror = (e) => {
      console.error("SSE connection error:", e);
      setError("Connection error. Try refreshing the page.");
      ev.close();
    };

    return () => ev.close();
  }, []);

  return (
    <div className="mt-4 space-y-4 rounded border bg-gray-50 p-4 text-black">
      <p className="font-bold">Latest events:</p>

      {error && (
        <div className="rounded border border-red-300 bg-red-100 p-2 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={i} className="rounded border bg-white p-2">
          <p>
            <strong>{msg.type}</strong>
          </p>
          <pre className="text-sm break-words whitespace-pre-wrap">
            {"ip" in msg.data ? `IP: ${msg.data.ip}` : msg.data.message}
          </pre>
        </div>
      ))}
    </div>
  );
};
