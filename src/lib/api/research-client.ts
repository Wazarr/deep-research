interface StreamEvent {
  event: string;
  data: any;
}

interface StreamHandlers {
  onProgress?: (data: any) => void;
  onMessage?: (data: any) => void;
  onError?: (data: any) => void;
  onConnected?: (data: any) => void;
  onFinalReport?: (data: any) => void;
}

interface CreateSessionRequest {
  settings: {
    provider: string;
    thinkingModel: string;
    taskModel: string;
    searchProvider: string;
    language?: string;
    maxResults?: number;
    enableCitationImage?: boolean;
    enableReferences?: boolean;
  };
  expiresIn?: number;
}

interface Session {
  id: string;
  topic?: string;
  phase: string;
  createdAt: string;
  updatedAt: string;
  questions?: string;
  feedback?: string;
  reportPlan?: string;
  finalReport?: string;
  tasks?: SearchTask[];
  resources?: Resource[];
  requirement?: string;
  error?: string;
}

class ResearchAPIClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl = "", apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    const result = await response.json();
    // Handle wrapped API responses that have {success, data, message} format
    if (result && typeof result === "object" && "success" in result && "data" in result) {
      return result.data;
    }
    return result;
  }

  // Session Management
  async createSession(request: CreateSessionRequest): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    return this.handleResponse(response);
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }
  }

  // Research Workflow
  async generateQuestions(sessionId: string, topic: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}/questions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate questions: ${response.statusText}`);
    }
  }

  async submitFeedback(sessionId: string, feedback: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}/feedback`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ feedback }),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit feedback: ${response.statusText}`);
    }
  }

  async createPlan(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}/plan`, {
      method: "POST",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to create plan: ${response.statusText}`);
    }
  }

  async executeResearch(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}/execute`, {
      method: "POST",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute research: ${response.statusText}`);
    }
  }

  async refineResearch(sessionId: string, suggestion: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}/refine`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ suggestion }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refine research: ${response.statusText}`);
    }
  }

  // Resource Management
  async addResource(sessionId: string, resource: Resource): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}/resources`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(resource),
    });

    if (!response.ok) {
      throw new Error(`Failed to add resource: ${response.statusText}`);
    }
  }

  async removeResource(sessionId: string, resourceId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/research/sessions/${sessionId}/resources/${resourceId}`,
      {
        method: "DELETE",
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to remove resource: ${response.statusText}`);
    }
  }

  // Results
  async getResults(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}/results`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async getFinalReport(sessionId: string): Promise<any> {
    const session = await this.getSession(sessionId);
    return {
      content: session.finalReport,
      phase: session.phase,
    };
  }

  // Export
  async exportSession(
    sessionId: string,
    format: "markdown" | "pdf" | "docx" = "markdown"
  ): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}/export`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ format }),
    });

    if (!response.ok) {
      throw new Error(`Failed to export session: ${response.statusText}`);
    }

    return response.blob();
  }

  // Streaming
  subscribeToSession(sessionId: string, handlers: StreamHandlers): EventSource {
    // Handle relative URLs when baseUrl is empty
    const streamPath = `/api/research/sessions/${sessionId}/stream`;
    const fullUrl = this.baseUrl ? `${this.baseUrl}${streamPath}` : streamPath;

    const url = new URL(fullUrl, window.location.origin);

    // Add API key as query parameter since EventSource doesn't support headers
    if (this.apiKey) {
      url.searchParams.set("apiKey", this.apiKey);
    }

    const eventSource = new EventSource(url.toString());

    eventSource.addEventListener("connected", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        handlers.onConnected?.(data);
      } catch (error) {
        console.error("Failed to parse connected event:", error);
      }
    });

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        handlers.onProgress?.(data);
      } catch (error) {
        console.error("Failed to parse progress event:", error);
      }
    });

    eventSource.addEventListener("message", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        handlers.onMessage?.(data);
      } catch (error) {
        console.error("Failed to parse message event:", error);
      }
    });

    eventSource.addEventListener("error", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        handlers.onError?.(data);
      } catch (error) {
        console.error("Failed to parse error event:", error);
        handlers.onError?.({ error: "Unknown streaming error" });
      }
    });

    eventSource.addEventListener("final-report", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        handlers.onFinalReport?.(data);
      } catch (error) {
        console.error("Failed to parse final-report event:", error);
      }
    });

    eventSource.onerror = (event) => {
      console.error("EventSource error:", event);
      handlers.onError?.({ error: "Connection error" });
    };

    return eventSource;
  }

  // Suggestion
  async getSuggestion(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/research/sessions/${sessionId}/suggestion`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  // Knowledge Graph
  async getKnowledgeGraph(sessionId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/api/research/sessions/${sessionId}/knowledge-graph`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse(response);
  }
}

// Singleton instance
let apiClient: ResearchAPIClient | null = null;

export function getResearchAPIClient(): ResearchAPIClient {
  if (!apiClient) {
    // Get API key from local storage or environment
    const apiKey =
      typeof window !== "undefined"
        ? localStorage.getItem("deep-research-api-key")
        : process.env.NEXT_PUBLIC_API_KEY;

    apiClient = new ResearchAPIClient("", apiKey || undefined);
  }
  return apiClient;
}

export { ResearchAPIClient };
export type { Session, CreateSessionRequest, StreamHandlers, StreamEvent };
