import { z } from "zod";
import type { DeepResearchSearchTask } from "@/utils/deep-research";

export interface ResearchSettings {
  provider: string;
  thinkingModel: string;
  taskModel: string;
  searchProvider: string;
  language?: string;
  maxResults?: number;
  enableCitationImage?: boolean;
  enableReferences?: boolean;
}

export interface ResearchSession {
  id: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  phase: "topic" | "questions" | "feedback" | "planning" | "executing" | "completed" | "error";
  topic?: string;
  questions?: string;
  feedback?: string;
  reportPlan?: string;
  tasks?: DeepResearchSearchTask[];
  results?: SearchTask[];
  finalReport?: string;
  error?: string;
  settings: ResearchSettings;
}

export const CreateSessionSchema = z.object({
  settings: z.object({
    provider: z.string(),
    thinkingModel: z.string(),
    taskModel: z.string(),
    searchProvider: z.string(),
    language: z.string().optional(),
    maxResults: z.number().min(1).max(20).optional(),
    enableCitationImage: z.boolean().optional(),
    enableReferences: z.boolean().optional(),
  }),
  expiresIn: z.number().min(300).max(86400).optional(), // 5 minutes to 24 hours
});

export const QuestionsRequestSchema = z.object({
  topic: z.string().min(1).max(1000),
});

export const FeedbackRequestSchema = z.object({
  feedback: z.string().min(1).max(2000),
});

export const PlanRequestSchema = z.object({
  topic: z.string().min(1).max(1000),
  questions: z.string().optional(),
  feedback: z.string().optional(),
});

export const ExecuteRequestSchema = z.object({
  reportPlan: z.string().min(1),
});

export const RefineRequestSchema = z.object({
  refinement: z.string().min(1).max(1000),
  phase: z.enum(["questions", "feedback", "planning", "executing"]),
});

export type CreateSessionRequest = z.infer<typeof CreateSessionSchema>;
export type QuestionsRequest = z.infer<typeof QuestionsRequestSchema>;
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>;
export type RefineRequest = z.infer<typeof RefineRequestSchema>;

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SessionListResponse {
  sessions: Pick<ResearchSession, "id" | "createdAt" | "updatedAt" | "phase" | "topic">[];
  total: number;
}
