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

  // Enhanced fields from TaskStore for feature parity
  resources?: Resource[];
  requirement?: string;
  suggestion?: string;
  knowledgeGraph?: string;
  images?: ImageSource[];
  sources?: Source[];
  title?: string;
  query?: string;

  // Metadata
  version?: number;
  metadata?: Record<string, any>;
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

export const UpdateRequirementSchema = z.object({
  requirement: z.string().min(1).max(2000),
});

export const UpdateSuggestionSchema = z.object({
  suggestion: z.string().min(1).max(2000),
});

export const UpdateKnowledgeGraphSchema = z.object({
  knowledgeGraph: z.string().min(1),
});

export type CreateSessionRequest = z.infer<typeof CreateSessionSchema>;
export type QuestionsRequest = z.infer<typeof QuestionsRequestSchema>;
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>;
export type RefineRequest = z.infer<typeof RefineRequestSchema>;
export type UpdateRequirementRequest = z.infer<typeof UpdateRequirementSchema>;
export type UpdateSuggestionRequest = z.infer<typeof UpdateSuggestionSchema>;
export type UpdateKnowledgeGraphRequest = z.infer<typeof UpdateKnowledgeGraphSchema>;

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

// Knowledge Management Types
export interface KnowledgeResponse {
  id: string;
  title: string;
  type: "file" | "url" | "knowledge";
  size: number;
  status: "processing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  userId?: string;
  url?: string;
  fileMeta?: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
  };
}

export interface ListKnowledgeResponse {
  knowledge: KnowledgeResponse[];
  total: number;
}

export const UploadKnowledgeSchema = z
  .object({
    type: z.enum(["file", "url", "text"]),
    title: z.string().optional(),
    content: z.string().optional(),
    url: z.string().url().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "text" && !data.content) return false;
      if (data.type === "url" && !data.url) return false;
      return true;
    },
    {
      message: "Content is required for text type, URL is required for url type",
    }
  );

export const AttachResourcesSchema = z.object({
  knowledgeIds: z.array(z.string()),
});

export type UploadKnowledgeRequest = z.infer<typeof UploadKnowledgeSchema>;
export type AttachResourcesRequest = z.infer<typeof AttachResourcesSchema>;

// User Management Types
export interface UserProfile {
  userId: string;
  email?: string;
  settings?: UserSettings;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  // Mirror SettingStore structure
  provider: string;
  thinkingModel: string;
  taskModel: string;
  searchProvider: string;
  theme: string;
  language: string;
  enableSearch: boolean;
  searchMaxResult: number;
  parallelSearch: number;
  enableCitationImage: boolean;
  enableReferences: boolean;
  // Additional settings
  maxSessionDuration?: number;
  defaultExpirationTime?: number;
}

export interface AuthResponse {
  userId: string;
  apiKey: string;
  expiresAt: string;
}

export const RegisterUserSchema = z.object({
  email: z.string().email().optional(),
  settings: z
    .object({
      provider: z.string().default("openai"),
      thinkingModel: z.string().default("gpt-4"),
      taskModel: z.string().default("gpt-4"),
      searchProvider: z.string().default("tavily"),
      theme: z.string().default("light"),
      language: z.string().default("en"),
      enableSearch: z.boolean().default(true),
      searchMaxResult: z.number().min(1).max(50).default(10),
      parallelSearch: z.number().min(1).max(10).default(3),
      enableCitationImage: z.boolean().default(true),
      enableReferences: z.boolean().default(true),
      maxSessionDuration: z.number().min(300).max(86400).default(3600),
      defaultExpirationTime: z.number().min(300).max(86400).default(3600),
    })
    .optional(),
});

export const UpdateSettingsSchema = z.object({
  provider: z.string().optional(),
  thinkingModel: z.string().optional(),
  taskModel: z.string().optional(),
  searchProvider: z.string().optional(),
  theme: z.string().optional(),
  language: z.string().optional(),
  enableSearch: z.boolean().optional(),
  searchMaxResult: z.number().min(1).max(50).optional(),
  parallelSearch: z.number().min(1).max(10).optional(),
  enableCitationImage: z.boolean().optional(),
  enableReferences: z.boolean().optional(),
  maxSessionDuration: z.number().min(300).max(86400).optional(),
  defaultExpirationTime: z.number().min(300).max(86400).optional(),
});

export type RegisterUserRequest = z.infer<typeof RegisterUserSchema>;
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsSchema>;

// History Management Types
export interface HistoryItem {
  id: string;
  userId?: string;
  sessionId: string;
  title: string;
  tags: string[];
  sessionData: ResearchSession;
  createdAt: string;
}

export interface ListHistoryResponse {
  history: HistoryItem[];
  total: number;
}

export const SaveHistorySchema = z.object({
  sessionId: z.string(),
  title: z.string().min(1).max(255).optional(),
  tags: z.array(z.string()).optional(),
});

export const RestoreHistorySchema = z.object({
  expiresIn: z.number().min(300).max(86400).optional(), // 5 minutes to 24 hours
});

export type SaveHistoryRequest = z.infer<typeof SaveHistorySchema>;
export type RestoreHistoryRequest = z.infer<typeof RestoreHistorySchema>;
