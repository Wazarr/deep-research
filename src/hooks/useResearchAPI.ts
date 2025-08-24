import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getResearchAPIClient, type Session, type StreamHandlers } from "@/lib/api/research-client";
import { useHistoryStore } from "@/store/history";
import { useSettingStore } from "@/store/setting";
import { useTaskStore } from "@/store/task";
import { parseError } from "@/utils/error";

interface StreamEvent {
  event: string;
  data: any;
  timestamp: string;
}

function useResearchAPI() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<string>("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const taskStore = useTaskStore();

  const handleError = useCallback((error: unknown) => {
    console.error("Research API Error:", error);
    const errorMessage = parseError(error);
    toast.error(errorMessage);
    setStreaming(false);
    setStatus("");
  }, []);

  const createSession = useCallback(
    async (topic: string, _resources?: Resource[]): Promise<Session> => {
      try {
        const client = getResearchAPIClient();
        const settings = useSettingStore.getState();

        const sessionRequest = {
          settings: {
            provider: settings.provider,
            thinkingModel: settings.thinkingModel,
            taskModel: settings.networkingModel, // API expects taskModel but store has networkingModel
            searchProvider:
              settings.searchProvider === "model" ? "tavily" : settings.searchProvider,
            language: settings.language,
            maxResults: settings.searchMaxResult,
            enableCitationImage: settings.citationImage === "enable",
            enableReferences: settings.references === "enable",
          },
          expiresIn: 3600, // 1 hour
        };

        console.log("Creating session with:", sessionRequest);
        const newSession = await client.createSession(sessionRequest);
        console.log("API returned session:", newSession);

        setSession(newSession);
        taskStore.setId(newSession.id);
        taskStore.setQuestion(topic);

        return newSession;
      } catch (error) {
        handleError(error);
        throw error;
      }
    },
    [taskStore, handleError]
  );

  const getSession = useCallback(
    async (sessionId: string): Promise<Session | null> => {
      try {
        const client = getResearchAPIClient();
        const sessionData = await client.getSession(sessionId);
        setSession(sessionData);

        // Sync session data with task store
        if (sessionData) {
          if (sessionData.topic && sessionData.topic !== taskStore.title) {
            taskStore.setTitle(sessionData.topic);
          }
          if (sessionData.questions && sessionData.questions !== taskStore.questions) {
            taskStore.updateQuestions(sessionData.questions);
          }
          if (sessionData.feedback && sessionData.feedback !== taskStore.feedback) {
            taskStore.setSuggestion(sessionData.feedback);
          }
          if (sessionData.reportPlan && sessionData.reportPlan !== taskStore.reportPlan) {
            taskStore.updateReportPlan(sessionData.reportPlan);
          }
          if (sessionData.tasks && sessionData.tasks.length > 0) {
            taskStore.update(sessionData.tasks);
          }
          if (sessionData.finalReport && sessionData.finalReport !== taskStore.finalReport) {
            taskStore.updateFinalReport(sessionData.finalReport);
            // If we have both title and final report, save to history
            if (sessionData.topic && sessionData.finalReport) {
              if (!taskStore.title) {
                taskStore.setTitle(sessionData.topic);
              }
              const { save } = useHistoryStore.getState();
              const id = save(taskStore.backup());
              if (id && !taskStore.id) {
                taskStore.setId(id);
              }
            }
          }
        }

        return sessionData;
      } catch (error) {
        handleError(error);
        return null;
      }
    },
    [handleError, taskStore]
  );

  const startStreaming = useCallback(
    (sessionId: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setStreaming(true);
      setEvents([]);

      const client = getResearchAPIClient();
      const handlers: StreamHandlers = {
        onConnected: (data) => {
          setEvents((prev) => [
            ...prev,
            {
              event: "connected",
              data,
              timestamp: new Date().toISOString(),
            },
          ]);
          console.log("Connected to session:", data);
        },

        onProgress: (data) => {
          setEvents((prev) => [
            ...prev,
            {
              event: "progress",
              data,
              timestamp: new Date().toISOString(),
            },
          ]);

          const { step, status: progressStatus } = data;

          // Update status based on step
          switch (step) {
            case "questions":
              setStatus(progressStatus === "start" ? t("research.common.thinking") : "");
              if (progressStatus === "end") {
                setStreaming(false);
                setStatus("");
              }
              break;
            case "feedback":
              setStatus(progressStatus === "start" ? t("research.common.processing") : "");
              break;
            case "plan":
              setStatus(progressStatus === "start" ? t("research.common.planning") : "");
              break;
            case "search":
              setStatus(progressStatus === "start" ? t("research.common.research") : "");
              break;
            case "final-report":
              setStatus(progressStatus === "start" ? t("research.common.writing") : "");
              if (progressStatus === "end") {
                setStreaming(false);
                setStatus("");
              }
              break;
          }
        },

        onMessage: (data) => {
          setEvents((prev) => [
            ...prev,
            {
              event: "message",
              data,
              timestamp: new Date().toISOString(),
            },
          ]);

          // Update task store based on message content
          if (data.questions) {
            taskStore.updateQuestions(data.questions);
          }
          if (data.reportPlan) {
            taskStore.updateReportPlan(data.reportPlan);
          }
          if (data.tasks) {
            taskStore.update(data.tasks);
          }
          if (data.finalReport) {
            taskStore.updateFinalReport(data.finalReport);
            // Ensure title is set from topic if available
            if (data.topic && !taskStore.title) {
              taskStore.setTitle(data.topic);
            }
            // Save to history
            const { save } = useHistoryStore.getState();
            const id = save(taskStore.backup());
            if (id) {
              taskStore.setId(id);
            }
          }
        },

        onError: (data) => {
          setEvents((prev) => [
            ...prev,
            {
              event: "error",
              data,
              timestamp: new Date().toISOString(),
            },
          ]);
          handleError(data.error || "Unknown streaming error");
        },

        onFinalReport: (data) => {
          setEvents((prev) => [
            ...prev,
            {
              event: "final-report",
              data,
              timestamp: new Date().toISOString(),
            },
          ]);

          if (data.finalReport) {
            taskStore.updateFinalReport(data.finalReport);
          }
          setStreaming(false);
          setStatus("");
        },
      };

      const eventSource = client.subscribeToSession(sessionId, handlers);
      eventSourceRef.current = eventSource;

      return eventSource;
    },
    [t, taskStore, handleError]
  );

  const askQuestions = useCallback(async () => {
    if (!session) {
      throw new Error("No active session");
    }

    try {
      setStatus(t("research.common.thinking"));
      const client = getResearchAPIClient();
      const currentTopic = taskStore.question;
      if (!currentTopic) {
        throw new Error("No topic available for question generation");
      }
      await client.generateQuestions(session.id, currentTopic);

      // Start streaming to get real-time updates
      startStreaming(session.id);
    } catch (error) {
      handleError(error);
    }
  }, [session, startStreaming, t, handleError]);

  const submitFeedback = useCallback(
    async (feedback: string) => {
      const sessionId = session?.id || taskStore.id;
      if (!sessionId) {
        throw new Error("No active session");
      }

      try {
        const client = getResearchAPIClient();
        await client.submitFeedback(sessionId, feedback);
        taskStore.setSuggestion(feedback);

        // Continue streaming for feedback processing
        if (!streaming) {
          startStreaming(sessionId);
        }
      } catch (error) {
        handleError(error);
      }
    },
    [session, streaming, startStreaming, taskStore, handleError]
  );

  const writeReportPlan = useCallback(async () => {
    const sessionId = session?.id || taskStore.id;
    if (!sessionId) {
      throw new Error("No active session");
    }

    try {
      const client = getResearchAPIClient();
      await client.createPlan(sessionId);

      if (!streaming) {
        startStreaming(sessionId);
      }
    } catch (error) {
      handleError(error);
    }
  }, [session, streaming, startStreaming, handleError]);

  const executeResearch = useCallback(async () => {
    const sessionId = session?.id || taskStore.id;
    if (!sessionId) {
      throw new Error("No active session");
    }

    try {
      const client = getResearchAPIClient();
      await client.executeResearch(sessionId);

      if (!streaming) {
        startStreaming(sessionId);
      }
    } catch (error) {
      handleError(error);
    }
  }, [session, streaming, startStreaming, handleError]);

  const refineResearch = useCallback(
    async (suggestion: string) => {
      if (!session) {
        throw new Error("No active session");
      }

      try {
        const client = getResearchAPIClient();
        await client.refineResearch(session.id, suggestion);

        if (!streaming) {
          startStreaming(session.id);
        }
      } catch (error) {
        handleError(error);
      }
    },
    [session, streaming, startStreaming, handleError]
  );

  const addResource = useCallback(
    async (resource: Resource) => {
      if (!session) {
        throw new Error("No active session");
      }

      try {
        const client = getResearchAPIClient();
        await client.addResource(session.id, resource);
        taskStore.addResource(resource);
      } catch (error) {
        handleError(error);
      }
    },
    [session, taskStore, handleError]
  );

  const removeResource = useCallback(
    async (resourceId: string) => {
      if (!session) {
        throw new Error("No active session");
      }

      try {
        const client = getResearchAPIClient();
        await client.removeResource(session.id, resourceId);
        taskStore.removeResource(resourceId);
      } catch (error) {
        handleError(error);
      }
    },
    [session, taskStore, handleError]
  );

  const exportSession = useCallback(
    async (format: "markdown" | "pdf" | "docx" = "markdown") => {
      if (!session) {
        throw new Error("No active session");
      }

      try {
        const client = getResearchAPIClient();
        const blob = await client.exportSession(session.id, format);

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `research-${session.id}.${format === "markdown" ? "md" : format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        handleError(error);
      }
    },
    [session, handleError]
  );

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreaming(false);
    setStatus("");
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Combined function that mimics the original useDeepResearch.deepResearch
  const deepResearch = useCallback(async () => {
    if (!session) {
      throw new Error("No active session");
    }

    try {
      // Start the full research workflow
      await executeResearch();
    } catch (error) {
      handleError(error);
    }
  }, [session, executeResearch, handleError]);

  // Combined function for the full workflow like the original askQuestions
  const startFullWorkflow = useCallback(
    async (topic: string, resources?: Resource[]) => {
      try {
        const newSession = await createSession(topic, resources);
        console.log("Session created:", newSession);

        if (!newSession?.id) {
          throw new Error("Invalid session created - no ID found");
        }

        // Start streaming BEFORE generating questions to catch all events
        startStreaming(newSession.id);

        // Small delay to ensure EventSource is connected
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Use the session directly instead of relying on state
        const client = getResearchAPIClient();
        await client.generateQuestions(newSession.id, topic);
      } catch (error) {
        handleError(error);
      }
    },
    [createSession, startStreaming, handleError]
  );

  return {
    // Session management
    session,
    createSession,
    getSession,

    // Streaming
    streaming,
    events,
    status,
    startStreaming,
    stopStreaming,

    // Research workflow
    askQuestions,
    submitFeedback,
    writeReportPlan,
    executeResearch,
    refineResearch,
    deepResearch,
    startFullWorkflow,

    // Resource management
    addResource,
    removeResource,

    // Export
    exportSession,

    // Compatibility functions (same names as useDeepResearch for easy replacement)
    // These will be used during migration to maintain compatibility
    runSearchTask: executeResearch,
    reviewSearchResult: refineResearch,
    writeFinalReport: executeResearch,
  };
}

export default useResearchAPI;
