import DeepResearch, { type DeepResearchOptions } from "@/utils/deep-research";
import type { DatabaseSessionManager } from "./db-session-manager";
import type { SessionManager } from "./session-manager";

export class APIDeepResearch extends DeepResearch {
  constructor(
    options: DeepResearchOptions,
    private sessionManager: SessionManager | DatabaseSessionManager,
    private sessionId: string
  ) {
    super(options);
  }

  override async writeReportPlan(query: string): Promise<string> {
    try {
      await this.sessionManager.update(this.sessionId, {
        phase: "planning",
        topic: query,
      });

      const result = await super.writeReportPlan(query);

      await this.sessionManager.update(this.sessionId, {
        reportPlan: result,
        phase: "planning",
      });

      return result;
    } catch (error) {
      await this.sessionManager.update(this.sessionId, {
        phase: "error",
        error: error instanceof Error ? error.message : "Unknown error during planning",
      });
      throw error;
    }
  }

  override async generateSERPQuery(reportPlan: string) {
    try {
      const result = await super.generateSERPQuery(reportPlan);

      await this.sessionManager.update(this.sessionId, {
        tasks: result,
      });

      return result;
    } catch (error) {
      await this.sessionManager.update(this.sessionId, {
        phase: "error",
        error: error instanceof Error ? error.message : "Unknown error during query generation",
      });
      throw error;
    }
  }

  override async runSearchTask(tasks: any[], enableReferences = true) {
    try {
      await this.sessionManager.update(this.sessionId, {
        phase: "executing",
      });

      const result = await super.runSearchTask(tasks, enableReferences);

      await this.sessionManager.update(this.sessionId, {
        results: result,
      });

      return result;
    } catch (error) {
      await this.sessionManager.update(this.sessionId, {
        phase: "error",
        error: error instanceof Error ? error.message : "Unknown error during search execution",
      });
      throw error;
    }
  }

  override async writeFinalReport(
    reportPlan: string,
    tasks: any[],
    enableCitationImage = true,
    enableReferences = true
  ) {
    try {
      const result = await super.writeFinalReport(
        reportPlan,
        tasks,
        enableCitationImage,
        enableReferences
      );

      await this.sessionManager.update(this.sessionId, {
        finalReport: result.finalReport,
        phase: "completed",
      });

      return result;
    } catch (error) {
      await this.sessionManager.update(this.sessionId, {
        phase: "error",
        error:
          error instanceof Error ? error.message : "Unknown error during final report generation",
      });
      throw error;
    }
  }

  override async start(query: string, enableCitationImage = true, enableReferences = true) {
    try {
      await this.sessionManager.update(this.sessionId, {
        phase: "executing",
        topic: query,
      });

      const result = await super.start(query, enableCitationImage, enableReferences);

      await this.sessionManager.update(this.sessionId, {
        finalReport: result.finalReport,
        phase: "completed",
      });

      return result;
    } catch (error) {
      await this.sessionManager.update(this.sessionId, {
        phase: "error",
        error: error instanceof Error ? error.message : "Unknown error during research execution",
      });
      throw error;
    }
  }

  async askQuestions(topic: string): Promise<string> {
    try {
      await this.sessionManager.update(this.sessionId, {
        phase: "questions",
        topic,
      });

      this.onMessage("progress", { step: "questions", status: "start" });

      const thinkingModel = await this.getThinkingModel();
      const { generateText } = await import("ai");

      const { text } = await generateText({
        model: thinkingModel,
        system:
          "You are an expert research assistant. Generate 3-5 clarifying questions to help refine the research scope and direction.",
        prompt: `Topic: ${topic}\n\nGenerate clarifying questions to better understand what the user wants to research. Focus on scope, specific aspects, target audience, and desired depth. Return just the questions, one per line, without numbering.`,
      });

      const questions = text.trim();

      await this.sessionManager.update(this.sessionId, {
        questions,
        phase: "questions",
      });

      this.onMessage("progress", {
        step: "questions",
        status: "end",
      });

      this.onMessage("message", {
        questions,
      });

      return questions;
    } catch (error) {
      await this.sessionManager.update(this.sessionId, {
        phase: "error",
        error: error instanceof Error ? error.message : "Unknown error during question generation",
      });
      throw error;
    }
  }

  async processFeedback(topic: string, questions: string, feedback: string): Promise<string> {
    try {
      await this.sessionManager.update(this.sessionId, {
        phase: "feedback",
        feedback,
      });

      this.onMessage("progress", { step: "process-feedback", status: "start" });

      const thinkingModel = await this.getThinkingModel();
      const { generateText } = await import("ai");

      const { text } = await generateText({
        model: thinkingModel,
        system:
          "You are an expert research assistant. Process the user's feedback and refine the research direction.",
        prompt: `Original Topic: ${topic}\n\nQuestions Asked:\n${questions}\n\nUser Feedback:\n${feedback}\n\nBased on this feedback, provide a refined research direction that incorporates the user's preferences and clarifications. Be specific about what aspects to focus on.`,
      });

      const refinedDirection = text.trim();

      await this.sessionManager.update(this.sessionId, {
        phase: "feedback",
      });

      this.onMessage("progress", {
        step: "process-feedback",
        status: "end",
        data: refinedDirection,
      });

      return refinedDirection;
    } catch (error) {
      await this.sessionManager.update(this.sessionId, {
        phase: "error",
        error: error instanceof Error ? error.message : "Unknown error during feedback processing",
      });
      throw error;
    }
  }
}
