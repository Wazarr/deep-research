# Deep Research API Feature Parity Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to bridge the gap between the current REST API endpoints and the main application functionality, enabling full feature parity and eventual migration from direct client-side logic to API-based architecture.

## Current State Analysis

### Main Application Features (Client-Side)

- **Research Flow**: Topic → Questions → Feedback → Plan → Execute → Report
- **Knowledge Management**: File uploads, URL crawling, local knowledge store
- **State Management**: Zustand stores (Task, History, Knowledge, Settings, Global)
- **Authentication**: None (runs entirely client-side)
- **Data Persistence**: Browser storage (localStorage/IndexedDB)
- **Settings**: Provider configs, search settings, UI preferences

### Current API Features

- **Basic Research Flow**: Session-based with phases
- **Authentication**: Simple Bearer token (API key)
- **State Management**: In-memory sessions with expiration
- **Limited Endpoints**: Create, execute, stream results
- **No Knowledge Management**: Missing file uploads, resources
- **No Persistence**: Sessions expire, no history

## Gap Analysis

### Critical Missing Features

#### 1. Knowledge Management System

**Gap**: No API for handling local resources (files, URLs, knowledge base)

- Main app: File uploads, URL crawling, knowledge storage
- API: None

#### 2. Complete State Model

**Gap**: API session model missing key fields from TaskStore

- Missing: `resources`, `requirement`, `suggestion`, `knowledgeGraph`, `images`
- Present: Basic research flow fields

#### 3. Persistent Storage

**Gap**: No long-term storage or history management

- Main app: Persistent history, knowledge base, settings
- API: Temporary sessions only

#### 4. User Management

**Gap**: No real user system or settings management

- Main app: Rich settings system with preferences
- API: Simple API key authentication

## Implementation Plan

### Phase 1: Knowledge Management APIs

#### 1.1 Knowledge Storage Endpoints

**`POST /api/knowledge`** - Upload Knowledge

```typescript
interface UploadKnowledgeRequest {
  type: 'file' | 'url' | 'text';
  data: File | string;
  title?: string;
}

interface KnowledgeResponse {
  id: string;
  title: string;
  type: 'file' | 'url' | 'knowledge';
  size: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
}
```

**`GET /api/knowledge`** - List Knowledge

```typescript
interface ListKnowledgeResponse {
  knowledge: KnowledgeResponse[];
  total: number;
}
```

**`GET /api/knowledge/:id`** - Get Knowledge Details
**`DELETE /api/knowledge/:id`** - Remove Knowledge
**`PUT /api/knowledge/:id`** - Update Knowledge

#### 1.2 Session Resource Management

**`POST /api/sessions/:id/resources`** - Attach Resources

```typescript
interface AttachResourcesRequest {
  knowledgeIds: string[];
}
```

**`GET /api/sessions/:id/resources`** - List Session Resources
**`DELETE /api/sessions/:id/resources/:resourceId`** - Remove Resource

#### Implementation Details

- Use same file processing logic as main app (`/src/hooks/useKnowledge.ts`)
- Store in database/file system instead of browser storage
- Support chunking for large files
- Implement status tracking for async processing

### Phase 2: Enhanced Session Management

#### 2.1 Extended Session Schema

```typescript
interface EnhancedResearchSession extends ResearchSession {
  // Add missing fields from TaskStore
  resources: Resource[];
  requirement: string;
  suggestion: string;
  knowledgeGraph: string;
  images: ImageSource[];
  
  // Add metadata
  userId: string;
  version: number;
  metadata?: Record<string, any>;
}
```

#### 2.2 Additional Session Endpoints

**`PUT /api/sessions/:id/requirement`** - Set Custom Requirements
**`PUT /api/sessions/:id/suggestion`** - Update Suggestions
**`PUT /api/sessions/:id/knowledge-graph`** - Update Knowledge Graph
**`GET /api/sessions/:id/export`** - Export Complete Session Data

#### Implementation Details

- Extend existing session manager
- Add validation for new fields
- Maintain backward compatibility
- Add versioning for schema evolution

### Phase 3: Authentication & User Management

#### 3.1 User System

**`POST /api/auth/register`** - Create Account (Optional)

```typescript
interface RegisterRequest {
  email?: string;  // Optional for anonymous users
  settings?: UserSettings;
}

interface AuthResponse {
  userId: string;
  apiKey: string;
  expiresAt: string;
}
```

**`POST /api/auth/token/refresh`** - Refresh Token
**`GET /api/auth/me`** - Get User Profile

#### 3.2 Settings Management

**`GET /api/auth/settings`** - Get User Settings
**`PUT /api/auth/settings`** - Update Settings

```typescript
interface UserSettings {
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
  // ... other settings
}
```

#### Implementation Details

- Support both anonymous (API key only) and registered users
- Encrypt API keys in storage
- Implement settings inheritance (default → user → session)
- Add settings validation and migration

### Phase 4: History & Persistence

#### 4.1 History Management

**`POST /api/history`** - Save Research to History

```typescript
interface SaveHistoryRequest {
  sessionId: string;
  title?: string;
  tags?: string[];
}
```

**`GET /api/history`** - List Research History
**`GET /api/history/:id`** - Get Specific Research
**`DELETE /api/history/:id`** - Remove from History
**`POST /api/history/:id/restore`** - Create New Session from History

#### 4.2 Database Schema

```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(35) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge table
CREATE TABLE knowledge (
  id VARCHAR(35) PRIMARY KEY,
  user_id VARCHAR(35) REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  type VARCHAR(20) NOT NULL,
  file_meta JSONB,
  url VARCHAR(1000),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table (extend existing)
ALTER TABLE sessions ADD COLUMN 
  resources JSONB DEFAULT '[]',
  requirement TEXT DEFAULT '',
  suggestion TEXT DEFAULT '',
  knowledge_graph TEXT DEFAULT '',
  images JSONB DEFAULT '[]',
  version INTEGER DEFAULT 1;

-- History table
CREATE TABLE research_history (
  id VARCHAR(35) PRIMARY KEY,
  user_id VARCHAR(35) REFERENCES users(id),
  session_data JSONB NOT NULL,
  title VARCHAR(255) NOT NULL,
  tags VARCHAR(255)[],
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Phase 5: Client SDK & Migration Tools

#### 5.1 TypeScript SDK

```typescript
class DeepResearchAPI {
  constructor(private apiKey: string, private baseURL: string) {}
  
  // Session management
  async createSession(settings: ResearchSettings): Promise<ResearchSession>
  async getSession(id: string): Promise<ResearchSession>
  async streamSession(id: string): Promise<ReadableStream>
  
  // Knowledge management  
  async uploadKnowledge(data: UploadKnowledgeRequest): Promise<KnowledgeResponse>
  async listKnowledge(): Promise<ListKnowledgeResponse>
  
  // History management
  async saveToHistory(sessionId: string): Promise<HistoryItem>
  async getHistory(): Promise<HistoryItem[]>
  
  // Settings management
  async getSettings(): Promise<UserSettings>
  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings>
}
```

#### 5.2 React Hooks

```typescript
// Replace useDeepResearch with API-based version
function useDeepResearchAPI() {
  const api = useAPI();
  
  return {
    createSession: (settings) => api.createSession(settings),
    streamResearch: (sessionId) => api.streamSession(sessionId),
    // ... other methods
  };
}

// Replace store hooks with API-backed versions
function useTaskStoreAPI(sessionId: string) {
  // Sync with API instead of local storage
}
```

#### 5.3 Migration Strategy

1. **Add API Mode Toggle**
   - Setting in UI: "Use API Mode" (default: false)
   - Conditional hook selection based on setting

2. **Parallel Implementation**
   - Keep existing direct logic as fallback
   - Implement API-based versions of hooks
   - Use feature flags to control rollout

3. **Progressive Migration**
   - Start with new research sessions only
   - Migrate existing features one by one
   - Provide data export/import tools

4. **Fallback System**
   - Automatic fallback to direct logic on API errors
   - User notification of mode switches
   - Graceful degradation

### Phase 6: Testing & Validation

#### 6.1 API Testing

- **Integration Tests**: Full research workflows
- **Load Testing**: Concurrent sessions, large file uploads
- **Error Scenarios**: Network failures, timeouts
- **Data Validation**: Schema compliance, security

#### 6.2 Migration Testing

- **Data Integrity**: Export/import consistency
- **Feature Parity**: Compare API vs direct results
- **Performance**: API vs direct mode benchmarks
- **User Experience**: Seamless mode switching

## Implementation Priorities

### High Priority (Implement First)

1. **Knowledge Management APIs** - Core missing functionality
2. **Extended Session Schema** - Foundation for feature parity
3. **Basic User Settings** - Enable customization

### Medium Priority

1. **History Management** - User convenience
2. **Enhanced Authentication** - Better user experience
3. **Client SDK** - Developer experience

### Low Priority (Nice to Have)

1. **Advanced Analytics** - Usage tracking, performance metrics
2. **Admin APIs** - User management, system monitoring
3. **Webhook System** - External integrations

## Technical Considerations

### Security

- **API Key Management**: Secure generation, rotation, storage
- **Input Validation**: All endpoints need comprehensive validation
- **Rate Limiting**: Per-user, per-endpoint limits
- **CORS Configuration**: Proper cross-origin setup

### Performance

- **Database Indexing**: User ID, session ID, timestamps
- **Caching Strategy**: Knowledge content, session state
- **Connection Pooling**: Database connection management
- **CDN Integration**: Static asset delivery

### Scalability  

- **Horizontal Scaling**: Stateless API design
- **Queue System**: Async processing for heavy tasks
- **Storage Strategy**: File uploads, knowledge storage
- **Monitoring**: Health checks, error tracking

## Success Metrics

### Technical Metrics

- **API Response Times**: < 200ms for most endpoints
- **Uptime**: 99.9% availability target
- **Error Rates**: < 1% of requests fail
- **Migration Success**: 0 data loss during transitions

### User Experience Metrics

- **Feature Parity**: 100% functionality match
- **Performance**: No degradation vs direct mode
- **Adoption Rate**: % of users enabling API mode
- **Support Tickets**: Minimal migration-related issues

## Timeline Estimation

- **Phase 1** (Knowledge APIs): 2-3 weeks
- **Phase 2** (Enhanced Sessions): 1-2 weeks
- **Phase 3** (Auth & Users): 2-3 weeks  
- **Phase 4** (History & DB): 1-2 weeks
- **Phase 5** (Client SDK): 2-3 weeks
- **Phase 6** (Testing): 1-2 weeks

**Total Estimated Timeline**: 9-15 weeks

## Conclusion

This implementation plan provides a clear roadmap to achieve feature parity between the API endpoints and the main application. The phased approach minimizes risk while enabling progressive migration and testing. Once complete, the system will support both modes with graceful fallback, providing a solid foundation for the long-term architectural evolution of the Deep Research platform.
