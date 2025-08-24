"use client";

import { CheckCircle, Clock, Database, Play, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface StreamEvent {
  event: string;
  data: any;
}

export default function TestEndpointsPage() {
  const [results, setResults] = useState<{
    validation?: ApiResponse;
    mockFlow?: ApiResponse;
    streaming?: { events: StreamEvent[]; complete: boolean; error?: string };
    loading: string | null;
  }>({
    loading: null,
  });

  const [config, setConfig] = useState({
    mode: "mock" as "mock" | "real",
    topic: "Planning a weekend trip to Barcelona",
    maxResults: 10,
  });

  const apiKey = "dr_Lu6BSzo52k8AfM7sQQE8UE_VnkxCOMqN";

  const runStandardEndpoint = async (endpoint: string, name: string) => {
    setResults((prev) => ({ ...prev, loading: name }));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      setResults((prev) => ({
        ...prev,
        [name]: data,
        loading: null,
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [name]: {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        loading: null,
      }));
    }
  };

  const runStreamingEndpoint = async () => {
    setResults((prev) => ({
      ...prev,
      loading: "streaming",
      streaming: { events: [], complete: false },
    }));

    try {
      const response = await fetch("/api/test/full-workflow/stream", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...config,
          provider: "google",
          thinkingModel: "gemini-2.0-flash-thinking-exp",
          taskModel: "gemini-2.0-flash-exp",
          searchProvider: "tavily",
          enableReferences: true,
          enableCitationImage: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader available");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            line.substring(7);
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              const eventType = lines[lines.indexOf(line) - 1]?.substring(7) || "unknown";

              setResults((prev) => ({
                ...prev,
                streaming: {
                  ...prev.streaming!,
                  events: [...prev.streaming!.events, { event: eventType, data }],
                },
              }));
            } catch (_e: any) {
              // Skip invalid JSON
            }
          }
        }
      }

      setResults((prev) => ({
        ...prev,
        streaming: { ...prev.streaming!, complete: true },
        loading: null,
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        streaming: {
          events: [],
          complete: true,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        loading: null,
      }));
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">API Endpoint Testing</h1>
        <p className="text-muted-foreground">Test individual endpoints with real-time output</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoint Validation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Validation
            </CardTitle>
            <CardDescription>Tests 9 session endpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runStandardEndpoint("/api/test/endpoint-validation", "validation")}
              disabled={results.loading === "validation"}
              className="w-full"
            >
              {results.loading === "validation" ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Test Endpoints
                </>
              )}
            </Button>

            {results.validation && (
              <div className="p-3 bg-muted rounded text-xs max-h-64 overflow-y-auto">
                {results.validation.success ? (
                  <div className="space-y-1">
                    {results.validation.data?.testResults?.map((test: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span>{test.test}</span>
                        <span
                          className={test.status.includes("✅") ? "text-green-600" : "text-red-600"}
                        >
                          {test.status.includes("✅") ? "✅" : "❌"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-red-600">{results.validation.error}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mock Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              Mock Flow
            </CardTitle>
            <CardDescription>Session workflow with mock data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runStandardEndpoint("/api/test/mock-paris-flow", "mockFlow")}
              disabled={results.loading === "mockFlow"}
              className="w-full"
            >
              {results.loading === "mockFlow" ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Mock Flow
                </>
              )}
            </Button>

            {results.mockFlow && (
              <div className="p-3 bg-muted rounded text-xs max-h-64 overflow-y-auto">
                {results.mockFlow.success ? (
                  <div className="space-y-1">
                    {results.mockFlow.data?.testLog?.map((log: string, i: number) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-red-600">{results.mockFlow.error}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Streaming Research */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              Streaming Research
            </CardTitle>
            <CardDescription>Real-time research with live output</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={config.mode}
                onValueChange={(value: "mock" | "real") =>
                  setConfig((prev) => ({ ...prev, mode: value }))
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock</SelectItem>
                  <SelectItem value="real">Real AI</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={config.maxResults}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, maxResults: parseInt(e.target.value, 10) || 10 }))
                }
                placeholder="Results"
                type="number"
                className="text-xs"
                min={1}
                max={20}
              />
            </div>

            <Input
              value={config.topic}
              onChange={(e) => setConfig((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="Research topic..."
              className="text-xs"
            />

            <Button
              onClick={runStreamingEndpoint}
              disabled={results.loading === "streaming"}
              className="w-full"
            >
              {results.loading === "streaming" ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Streaming...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Stream ({config.mode})
                </>
              )}
            </Button>

            {results.streaming && (
              <div className="p-3 bg-muted rounded text-xs max-h-64 overflow-y-auto">
                {results.streaming.events.length > 0 ? (
                  <div className="space-y-1">
                    {results.streaming.events.map((event, i) => (
                      <div key={i}>
                        {event.event === "progress" && (
                          <div className="text-blue-600">
                            [{event.data.step}] {event.data.status}
                          </div>
                        )}
                        {event.event === "message" && (
                          <div className="text-gray-700 pl-2 border-l-2 border-gray-300 whitespace-pre-wrap">
                            {event.data.content || event.data.text}
                          </div>
                        )}
                        {event.event === "error" && (
                          <div className="text-red-600">
                            Error: {event.data.error || JSON.stringify(event.data)}
                          </div>
                        )}
                      </div>
                    ))}
                    {!results.streaming.complete && (
                      <div className="text-blue-500 animate-pulse">Streaming...</div>
                    )}
                  </div>
                ) : results.streaming.error ? (
                  <div className="text-red-600">{results.streaming.error}</div>
                ) : (
                  <div className="text-gray-500">No events yet...</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
