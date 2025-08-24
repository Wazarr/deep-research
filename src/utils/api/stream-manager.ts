// Using globalThis to ensure persistence across Edge Runtime requests
if (!(globalThis as any).__streamStorage) {
  (globalThis as any).__streamStorage = new Map<string, Set<ReadableStreamDefaultController>>();
}

const sessionStreams = (globalThis as any).__streamStorage as Map<
  string,
  Set<ReadableStreamDefaultController>
>;

export function addStream(sessionId: string, controller: ReadableStreamDefaultController) {
  if (!sessionStreams.has(sessionId)) {
    sessionStreams.set(sessionId, new Set());
  }
  sessionStreams.get(sessionId)!.add(controller);
  console.log(
    `Added stream for session ${sessionId}, total clients: ${sessionStreams.get(sessionId)!.size}`
  );
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
  console.log(
    `Broadcasting ${event} to session ${sessionId}, ${streams?.size || 0} connected clients`
  );

  if (streams) {
    const encoder = new TextEncoder();
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = encoder.encode(message);

    for (const controller of streams) {
      try {
        controller.enqueue(encoded);
        console.log(`Successfully sent ${event} event to client`);
      } catch (error) {
        console.error("Stream broadcast error:", error);
        streams.delete(controller);
      }
    }
  } else {
    console.log(`No connected streams for session ${sessionId}`);
  }
}

export function getActiveStreams(sessionId: string): number {
  return sessionStreams.get(sessionId)?.size || 0;
}

// Debug function to check stream state
export function getStreamStats() {
  const stats = {
    totalSessions: sessionStreams.size,
    sessions: {} as Record<string, number>,
    totalStreams: 0,
    timestamp: new Date().toISOString(),
  };

  for (const [sessionId, streams] of sessionStreams.entries()) {
    stats.sessions[sessionId] = streams.size;
    stats.totalStreams += streams.size;
  }

  return stats;
}

// Function to clear all streams (for testing)
export function clearAllStreams() {
  console.log("Clearing all streams");
  for (const [sessionId, streams] of sessionStreams.entries()) {
    for (const controller of streams) {
      try {
        controller.close();
      } catch (error) {
        console.error(`Error closing stream for session ${sessionId}:`, error);
      }
    }
  }
  sessionStreams.clear();
}
