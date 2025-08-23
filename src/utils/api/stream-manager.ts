const sessionStreams = new Map<string, Set<ReadableStreamDefaultController>>();

export function addStream(sessionId: string, controller: ReadableStreamDefaultController) {
  if (!sessionStreams.has(sessionId)) {
    sessionStreams.set(sessionId, new Set());
  }
  sessionStreams.get(sessionId)!.add(controller);
}

export function removeStream(sessionId: string, controller: ReadableStreamDefaultController) {
  const streams = sessionStreams.get(sessionId);
  if (streams) {
    streams.delete(controller);
    if (streams.size === 0) {
      sessionStreams.delete(sessionId);
    }
  }
}

export function broadcast(sessionId: string, event: string, data: any) {
  const streams = sessionStreams.get(sessionId);
  if (streams) {
    const encoder = new TextEncoder();
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = encoder.encode(message);

    for (const controller of streams) {
      try {
        controller.enqueue(encoded);
      } catch (error) {
        console.error("Stream broadcast error:", error);
        streams.delete(controller);
      }
    }
  }
}

export function getActiveStreams(sessionId: string): number {
  return sessionStreams.get(sessionId)?.size || 0;
}
