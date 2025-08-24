# Main Page API Migration Plan

## Executive Summary

This plan outlines the migration of the main page from using custom client-side logic with hooks (`useDeepResearch`) to utilizing the REST API endpoints that have been developed. After analyzing the codebase, this migration is both **technically feasible** and **recommended** for improved architecture and maintainability.

## Assessment

### 1. Is it a Good Idea? **YES**

**Benefits:**
- **Separation of Concerns**: Cleanly separates UI from business logic
- **Better Testing**: API endpoints can be tested independently 
- **Reusability**: Same API can power multiple clients (web, mobile, CLI)
- **Scalability**: Easier to scale and optimize server-side processing
- **Session Management**: Proper session persistence and state management via database
- **Authentication**: Centralized auth handling with JWT tokens
- **Streaming**: SSE support already built into API endpoints
- **Error Handling**: Consistent error handling across the application

**Trade-offs:**
- Slightly increased complexity for simple operations
- Need to manage API calls and error states
- Potential for increased latency (mitigated by streaming)

### 2. Is it Technically Feasible? **YES**

The API infrastructure is fully developed with:
- Session-based workflow (`/api/research/sessions`)
- Streaming support (`/api/research/sessions/[sessionId]/stream`)
- Full research lifecycle endpoints (questions, plan, execute, feedback)
- Authentication and authorization
- Database persistence
- Resource management (knowledge base integration)

## Current Architecture Analysis

### Client-Side (Current)
```
Page.tsx → Topic.tsx → useDeepResearch hook → Direct AI/Search calls
         → Feedback.tsx → Zustand stores
         → SearchResult.tsx
         → FinalReport.tsx
```

**Key Components:**
- `useDeepResearch`: Contains all research logic (600+ lines)
- Direct AI provider calls via client-side SDK
- Zustand stores for state management
- No session persistence beyond local storage

### API-Based (Target)
```
Page.tsx → Topic.tsx → API Client → /api/research/sessions/*
         → Feedback.tsx → SSE Stream → Real-time updates
         → SearchResult.tsx
         → FinalReport.tsx
```

**Key Components:**
- RESTful API with session management
- Server-side research orchestration
- SSE for real-time streaming
- Database persistence

## Implementation Plan

### Phase 1: API Client Development

#### 1.1 Create Research API Client
```typescript
// src/lib/api/research-client.ts
class ResearchAPIClient {
  // Session management
  async createSession(topic: string, resources?: Resource[]): Promise<Session>
  async getSession(sessionId: string): Promise<Session>
  
  // Research workflow
  async generateQuestions(sessionId: string): Promise<void>
  async submitFeedback(sessionId: string, feedback: string): Promise<void>
  async createPlan(sessionId: string): Promise<void>
  async executeResearch(sessionId: string): Promise<void>
  
  // Streaming
  subscribeToSession(sessionId: string, handlers: StreamHandlers): EventSource
  
  // Results
  async getResults(sessionId: string): Promise<SearchResults>
  async getFinalReport(sessionId: string): Promise<Report>
}
```

#### 1.2 Create React Hooks for API
```typescript
// src/hooks/useResearchAPI.ts
export function useResearchSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [events, setEvents] = useState<StreamEvent[]>([])
  
  // Methods for session lifecycle
  const createSession = async (topic: string) => {...}
  const startResearch = async () => {...}
  const submitFeedback = async (feedback: string) => {...}
  
  return { session, streaming, events, createSession, startResearch, submitFeedback }
}
```

### Phase 2: Component Migration

#### 2.1 Update Topic Component
```typescript
// Migrate from useDeepResearch to useResearchAPI
- const { askQuestions } = useDeepResearch()
+ const { createSession, startResearch } = useResearchAPI()

// Update submit handler
async function handleSubmit(values) {
  const session = await createSession(values.topic)
  await startResearch(session.id)
}
```

#### 2.2 Update Feedback Component
```typescript
// Use API for feedback submission
- const { reviewSearchResult } = useDeepResearch()
+ const { submitFeedback } = useResearchAPI()
```

#### 2.3 Update Result Components
```typescript
// Subscribe to SSE stream for real-time updates
useEffect(() => {
  if (session?.id) {
    const eventSource = client.subscribeToSession(session.id, {
      onProgress: (data) => updateProgress(data),
      onMessage: (data) => appendContent(data),
      onError: (error) => handleError(error)
    })
    return () => eventSource.close()
  }
}, [session])
```

### Phase 3: State Management Migration

#### 3.1 Adapt Zustand Stores
- Keep stores for UI state and local preferences
- Remove research logic from stores
- Add session state management
- Sync with API responses

#### 3.2 Session Persistence
```typescript
// Auto-save session ID to localStorage
// Resume sessions on page reload
// Handle session expiration
```

### Phase 4: Feature Parity Verification

#### 4.1 Core Features Checklist
- [ ] Topic submission with resources
- [ ] Question generation
- [ ] User feedback integration  
- [ ] Report planning
- [ ] Search execution (parallel)
- [ ] Result processing
- [ ] Final report generation
- [ ] Streaming updates
- [ ] Error handling
- [ ] Session history
- [ ] Knowledge base integration

#### 4.2 Advanced Features
- [ ] Multi-language support
- [ ] Provider selection (AI & Search)
- [ ] Citation management
- [ ] Image integration
- [ ] Export functionality

### Phase 5: Testing & Optimization

#### 5.1 Testing Strategy
- Unit tests for API client
- Integration tests for components
- E2E tests for full workflow
- Performance testing for streaming

#### 5.2 Optimization
- Implement request caching
- Add retry logic
- Optimize SSE connection management
- Add offline support

## Migration Timeline

**Week 1: Foundation**
- Day 1-2: Create API client library
- Day 3-4: Develop React hooks
- Day 5: Initial component updates

**Week 2: Core Migration**
- Day 1-2: Migrate Topic component
- Day 3: Migrate Feedback component  
- Day 4-5: Migrate Result components

**Week 3: Polish & Testing**
- Day 1-2: State management updates
- Day 3-4: Testing and bug fixes
- Day 5: Performance optimization

## Migration Strategy

**Full Rollout Approach:**
- Direct replacement of `useDeepResearch` with API-based implementation
- Complete migration in a single deployment
- No feature flags or conditional logic
- Clean removal of old client-side logic

**Implementation Steps:**
1. Build and test API client thoroughly
2. Replace all hook references in components
3. Remove unused client-side research logic
4. Deploy as complete replacement

## Success Metrics

1. **Functional**: All features work identically to current implementation
2. **Performance**: Response time ≤ current implementation  
3. **Reliability**: Error rate < 1%
4. **UX**: Smooth streaming without interruptions
5. **Maintainability**: Reduced code complexity

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API latency | High | Use streaming, optimize endpoints |
| Session management complexity | Medium | Implement robust error recovery |
| Breaking changes | High | Feature flag, comprehensive testing |
| State synchronization | Medium | Clear state management patterns |

## Conclusion

The migration from custom client-side logic to API-based architecture is both feasible and beneficial. The API endpoints provide a solid foundation with session management, streaming, and proper separation of concerns. The phased approach with feature flags ensures a safe migration path with minimal risk to users.

**Recommendation**: Proceed with the migration following this plan, starting with Phase 1 (API Client Development).