# Deep Research API Documentation

## Overview

The Deep Research API provides a comprehensive session-based interface for conducting AI-powered research. The API follows REST principles with real-time streaming capabilities via Server-Sent Events (SSE).

## Base URL

```
https://your-domain.com/api/research
```

## Authentication

All API endpoints require authentication via API key. Include your API key in one of these ways:

**Bearer Token (Recommended):**
```bash
Authorization: Bearer dr_your_api_key_here
```

**Custom Header:**
```bash
X-API-Key: dr_your_api_key_here
```

### API Key Format

API keys follow the format: `dr_` + 32 character random string (e.g., `dr_abc123...`)

## Rate Limits

Rate limits are applied per API key per endpoint:

| Endpoint | Limit | Window |
|----------|-------|---------|
| `sessions:create` | 10 requests | 1 hour |
| `sessions:get` | 1000 requests | 1 hour |
| `sessions:execute` | 50 requests | 1 hour |
| All others | 100 requests | 1 hour |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

## Session Lifecycle

Research sessions follow this lifecycle:

```
1. topic → 2. questions → 3. feedback → 4. planning → 5. executing → 6. completed
                                                                        └─→ error
```

### Phase Descriptions

- **topic**: Initial phase after session creation
- **questions**: AI has generated clarifying questions
- **feedback**: Waiting for user feedback on questions
- **planning**: Generating research plan and search tasks
- **executing**: Running research tasks
- **completed**: Research finished successfully
- **error**: An error occurred during processing

## Endpoints

### Sessions

#### Create Session
```
POST /api/research/sessions
```

Creates a new research session with the specified settings.

**Request Body:**
```json
{
  "settings": {
    "provider": "openai",
    "thinkingModel": "gpt-4o",
    "taskModel": "gpt-4o-mini",
    "searchProvider": "tavily",
    "language": "en",
    "maxResults": 10,
    "enableReferences": true,
    "enableCitationImage": true
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc123",
    "phase": "topic",
    "message": "Session created successfully"
  }
}
```

#### List Sessions
```
GET /api/research/sessions
```

Returns all sessions owned by the authenticated user.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "phase": "completed",
      "topic": "Climate change impacts",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T01:00:00Z",
      "expiresAt": "2024-01-02T00:00:00Z"
    }
  ]
}
```

#### Get Session
```
GET /api/research/sessions/{sessionId}
```

Returns details for a specific session.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "phase": "completed",
    "topic": "Climate change impacts",
    "questions": "What are the main impacts...",
    "feedback": "Focus on economic impacts...",
    "reportPlan": "1. Economic impacts...",
    "finalReport": "# Climate Change Economic Impacts...",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T01:00:00Z",
    "expiresAt": "2024-01-02T00:00:00Z"
  }
}
```

#### Delete Session
```
DELETE /api/research/sessions/{sessionId}
```

Deletes a session. Only the session owner can delete their sessions.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Session deleted successfully"
  }
}
```

### Research Flow

#### Submit Topic and Get Questions
```
POST /api/research/sessions/{sessionId}/questions
```

Submit a research topic and receive AI-generated clarifying questions.

**Request Body:**
```json
{
  "topic": "The impact of artificial intelligence on employment"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc123",
    "questions": "1. Which industries are you most interested in?\n2. Are you looking for short-term or long-term impacts?\n3. Should we focus on job displacement or job creation?",
    "phase": "questions"
  }
}
```

#### Submit Feedback
```
POST /api/research/sessions/{sessionId}/feedback
```

Provide feedback on the generated questions to refine research direction.

**Request Body:**
```json
{
  "feedback": "Focus on the technology sector, particularly software development roles. Look at both short-term displacement and long-term adaptation strategies."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc123",
    "phase": "feedback",
    "message": "Feedback processed successfully"
  }
}
```

#### Generate Research Plan
```
POST /api/research/sessions/{sessionId}/plan
```

Generate a detailed research plan based on the topic and feedback.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc123",
    "reportPlan": "# Research Plan\n\n## 1. Current State Analysis\n...",
    "tasks": [
      {
        "query": "AI impact software development jobs 2024",
        "focus": "Recent trends in AI automation"
      }
    ],
    "phase": "planning"
  }
}
```

#### Execute Research
```
POST /api/research/sessions/{sessionId}/execute
```

Execute the research plan and generate the final report.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc123",
    "finalReport": "# AI Impact on Software Development...",
    "results": [
      {
        "query": "AI impact software development jobs 2024",
        "sources": [
          {
            "title": "AI's Impact on Software Jobs",
            "url": "https://example.com/article",
            "content": "Recent studies show..."
          }
        ]
      }
    ],
    "phase": "completed"
  }
}
```

#### Get Results
```
GET /api/research/sessions/{sessionId}/results
```

Get current results and progress for an active session.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc123",
    "phase": "executing",
    "results": [
      {
        "query": "AI impact software development jobs 2024",
        "sources": [...]
      }
    ],
    "progress": 75
  }
}
```

#### Refine Session
```
POST /api/research/sessions/{sessionId}/refine
```

Refine the session at any stage (questions, feedback, or planning).

**Request Body:**
```json
{
  "phase": "questions",
  "refinement": "Updated questions focusing on specific aspects..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc123",
    "phase": "questions",
    "message": "Session refined successfully"
  }
}
```

### Real-time Updates

#### Stream Session Updates
```
GET /api/research/sessions/{sessionId}/stream
```

Server-Sent Events endpoint for real-time session updates.

**Response Headers:**
```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

**Event Types:**

**Connected Event:**
```
event: connected
data: {"sessionId": "abc123", "phase": "executing", "timestamp": "2024-01-01T00:00:00Z"}
```

**Progress Event:**
```
event: progress
data: {"phase": "executing", "progress": 25, "message": "Searching for sources..."}
```

**Final Report Event:**
```
event: final-report
data: {"finalReport": "# Research Report...", "phase": "completed"}
```

**Error Event:**
```
event: error
data: {"error": "Research execution failed", "phase": "error"}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Detailed error message",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_REQUEST | Invalid request body or parameters |
| 401 | AUTHENTICATION_REQUIRED | Missing or invalid API key |
| 403 | ACCESS_DENIED | User doesn't own the session |
| 404 | SESSION_NOT_FOUND | Session doesn't exist |
| 429 | RATE_LIMITED | Rate limit exceeded |
| 500 | INTERNAL_ERROR | Server error |

## Usage Examples

### Complete Research Flow

```javascript
// 1. Create session
const session = await fetch('/api/research/sessions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer dr_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    settings: {
      provider: 'openai',
      thinkingModel: 'gpt-4o',
      taskModel: 'gpt-4o-mini',
      searchProvider: 'tavily'
    }
  })
}).then(r => r.json());

const sessionId = session.data.sessionId;

// 2. Submit topic
await fetch(`/api/research/sessions/${sessionId}/questions`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer dr_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    topic: 'The impact of AI on software development jobs'
  })
});

// 3. Provide feedback
await fetch(`/api/research/sessions/${sessionId}/feedback`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer dr_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    feedback: 'Focus on recent trends and specific programming roles'
  })
});

// 4. Generate plan
await fetch(`/api/research/sessions/${sessionId}/plan`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer dr_your_api_key',
    'Content-Type': 'application/json'
  }
});

// 5. Execute research
const result = await fetch(`/api/research/sessions/${sessionId}/execute`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer dr_your_api_key',
    'Content-Type': 'application/json'
  }
}).then(r => r.json());

console.log(result.data.finalReport);
```

### Streaming Updates

```javascript
const eventSource = new EventSource(
  `/api/research/sessions/${sessionId}/stream`,
  {
    headers: {
      'Authorization': 'Bearer dr_your_api_key'
    }
  }
);

eventSource.addEventListener('progress', (event) => {
  const data = JSON.parse(event.data);
  console.log(`Progress: ${data.progress}% - ${data.message}`);
});

eventSource.addEventListener('final-report', (event) => {
  const data = JSON.parse(event.data);
  console.log('Research completed:', data.finalReport);
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('Research error:', data.error);
  eventSource.close();
});
```

## Client SDK Example

```typescript
class DeepResearchClient {
  constructor(private apiKey: string, private baseUrl: string) {}

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async createSession(settings: ResearchSettings) {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ settings }),
    });
  }

  async submitTopic(sessionId: string, topic: string) {
    return this.request(`/sessions/${sessionId}/questions`, {
      method: 'POST',
      body: JSON.stringify({ topic }),
    });
  }

  async submitFeedback(sessionId: string, feedback: string) {
    return this.request(`/sessions/${sessionId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
  }

  async generatePlan(sessionId: string) {
    return this.request(`/sessions/${sessionId}/plan`, {
      method: 'POST',
    });
  }

  async executeResearch(sessionId: string) {
    return this.request(`/sessions/${sessionId}/execute`, {
      method: 'POST',
    });
  }

  streamSession(sessionId: string, callbacks: {
    onProgress?: (data: any) => void;
    onFinalReport?: (data: any) => void;
    onError?: (data: any) => void;
  }) {
    const eventSource = new EventSource(
      `${this.baseUrl}/sessions/${sessionId}/stream`,
      {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      }
    );

    if (callbacks.onProgress) {
      eventSource.addEventListener('progress', (event) => 
        callbacks.onProgress!(JSON.parse(event.data))
      );
    }

    if (callbacks.onFinalReport) {
      eventSource.addEventListener('final-report', (event) => 
        callbacks.onFinalReport!(JSON.parse(event.data))
      );
    }

    if (callbacks.onError) {
      eventSource.addEventListener('error', (event) => 
        callbacks.onError!(JSON.parse(event.data))
      );
    }

    return eventSource;
  }
}
```

## Settings Configuration

### AI Provider Settings

```typescript
interface ResearchSettings {
  provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'cohere';
  thinkingModel: string;  // High-capability model for planning
  taskModel: string;      // Efficient model for execution tasks
  searchProvider: 'tavily' | 'serper' | 'brave' | 'exa';
  language?: string;      // ISO language code (default: 'en')
  maxResults?: number;    // Max search results per query (default: 10)
  enableReferences?: boolean;     // Include source references (default: true)
  enableCitationImage?: boolean;  // Generate citation images (default: true)
}
```

### Recommended Model Configurations

**OpenAI:**
- Thinking Model: `gpt-4o` or `gpt-4o-2024-11-20`
- Task Model: `gpt-4o-mini`

**Anthropic:**
- Thinking Model: `claude-3-5-sonnet-20241022`
- Task Model: `claude-3-5-haiku-20241022`

**Google:**
- Thinking Model: `gemini-1.5-pro-002`
- Task Model: `gemini-1.5-flash-002`

## Advanced Usage

### Session Management

```javascript
// List all sessions
const sessions = await client.request('/sessions');

// Get session details
const session = await client.request(`/sessions/${sessionId}`);

// Delete session
await client.request(`/sessions/${sessionId}`, { method: 'DELETE' });

// Extend session expiration
await client.request(`/sessions/${sessionId}/extend`, { method: 'POST' });
```

### Error Handling

```javascript
try {
  const result = await client.executeResearch(sessionId);
} catch (error) {
  if (error.status === 429) {
    // Handle rate limiting
    const retryAfter = error.headers['Retry-After'];
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
  } else if (error.status === 403) {
    // Handle access denied
    console.log('You do not own this session');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

### Monitoring Progress

```javascript
const eventSource = client.streamSession(sessionId, {
  onProgress: (data) => {
    console.log(`${data.progress}%: ${data.message}`);
    
    // Update UI progress bar
    updateProgressBar(data.progress);
    
    // Log current phase
    if (data.phase === 'executing') {
      console.log('Research in progress...');
    }
  },
  
  onFinalReport: (data) => {
    console.log('Research completed!');
    displayReport(data.finalReport);
    eventSource.close();
  },
  
  onError: (data) => {
    console.error('Research failed:', data.error);
    eventSource.close();
  }
});
```

## Security Considerations

1. **API Key Protection**: Never expose API keys in client-side code
2. **HTTPS Only**: Always use HTTPS in production
3. **Session Ownership**: Users can only access their own sessions
4. **Rate Limiting**: Respect rate limits to avoid being blocked
5. **Input Validation**: All inputs are validated server-side

## Deployment Configuration

### Environment Variables

```bash
# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Search Provider API Keys  
TAVILY_API_KEY=tvly-...
SERPER_API_KEY=...
BRAVE_API_KEY=...

# Optional: Custom Provider URLs
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

### Edge Runtime Requirements

- Uses Next.js Edge Runtime for global performance
- In-memory session storage (sessions expire after 1 hour by default)
- No persistent database required
- Stateless deployment friendly

#### Session Persistence in Edge Runtime

**Important Note**: Due to Edge Runtime isolation, in-memory sessions are only guaranteed to persist within the same route handler context. For cross-route session access:

1. **Production**: Use external session storage (Redis, database)
2. **Development**: Complete research workflows within single API calls
3. **Testing**: Use the provided test endpoints that handle complete flows

**Recommended Production Setup**:
```typescript
// For production, implement a RedisSessionStore
class RedisSessionStore implements SessionStore {
  // Redis implementation for persistent sessions
}
```

**Development Workflow**:
- Use `/api/test/mock-paris-flow` for complete flow testing
- Each route handler maintains its own session context
- Sessions created in one route may not be accessible from another route in development

## Migration from Legacy API

If migrating from the legacy `/api/sse` endpoint:

### Before (Legacy)
```javascript
const response = await fetch('/api/sse', {
  method: 'POST',
  body: JSON.stringify({ query: 'research topic' })
});
```

### After (Session-based)
```javascript
// 1. Create session
const session = await fetch('/api/research/sessions', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer dr_your_key' },
  body: JSON.stringify({ settings: { provider: 'openai' } })
});

// 2. Submit topic
await fetch(`/api/research/sessions/${sessionId}/questions`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer dr_your_key' },
  body: JSON.stringify({ topic: 'research topic' })
});

// 3. Continue with feedback, plan, execute...
```

## Support

For issues or questions:
- GitHub Issues: [Repository Issues](https://github.com/your-repo/issues)
- Documentation: [Full Documentation](https://docs.your-domain.com)