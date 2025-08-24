# SQLite + Drizzle ORM Implementation Plan

## Executive Summary

Replace the problematic in-memory storage approach with a proper SQLite database using Drizzle ORM to achieve reliable persistence across Edge Runtime API routes. This will solve the Edge Runtime isolation issues and provide true feature parity.

## Problem Analysis

### Current Issues

- **Edge Runtime Isolation**: Each API route gets isolated context, preventing storage sharing
- **In-Memory Storage Failure**: Maps don't persist between different API endpoint invocations  
- **Data Loss**: User registration succeeds but user retrieval fails due to storage isolation
- **Feature Gap**: 43% success rate instead of 100% due to storage reliability issues

### Root Cause

Edge Runtime creates separate execution contexts for each API route, making traditional singleton patterns and global storage unreliable.

## Solution Overview

Implement SQLite database with Drizzle ORM for:

- **Users & Authentication** - Persistent user profiles and settings
- **Knowledge Management** - File uploads, URLs, and text knowledge
- **Research History** - Session history with search and tags  
- **Enhanced Sessions** - Full TaskStore field compatibility

## Implementation Plan

### Phase 1: Database Setup & Schema Design

#### 1.1 Install Dependencies

```bash
pnpm add drizzle-orm better-sqlite3
pnpm add -D drizzle-kit @types/better-sqlite3
```

#### 1.2 Database Schema Design

```typescript
// schema.ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // API key serves as user ID
  email: text('email').unique(),
  settings: text('settings', { mode: 'json' }).notNull().default('{}'),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
});

export const knowledge = sqliteTable('knowledge', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: text('type', { enum: ['file', 'url', 'knowledge'] }).notNull(),
  content: text('content'),
  url: text('url'),
  fileMeta: text('file_meta', { mode: 'json' }),
  status: text('status', { enum: ['processing', 'completed', 'failed'] }).notNull().default('processing'),
  size: integer('size').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
  updatedAt: text('updated_at').notNull().default(sql`datetime('now')`),
  expiresAt: text('expires_at').notNull(),
  phase: text('phase', { 
    enum: ['topic', 'questions', 'feedback', 'planning', 'executing', 'completed', 'error'] 
  }).notNull().default('topic'),
  
  // Core session data
  topic: text('topic'),
  questions: text('questions'),
  feedback: text('feedback'),
  reportPlan: text('report_plan'),
  tasks: text('tasks', { mode: 'json' }).default('[]'),
  results: text('results', { mode: 'json' }).default('[]'),
  finalReport: text('final_report'),
  error: text('error'),
  settings: text('settings', { mode: 'json' }).notNull(),
  
  // Enhanced fields for full TaskStore parity
  resources: text('resources', { mode: 'json' }).default('[]'),
  requirement: text('requirement').default(''),
  suggestion: text('suggestion').default(''),
  knowledgeGraph: text('knowledge_graph').default(''),
  images: text('images', { mode: 'json' }).default('[]'),
  sources: text('sources', { mode: 'json' }).default('[]'),
  title: text('title').default(''),
  query: text('query').default(''),
  version: integer('version').notNull().default(1),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
});

export const history = sqliteTable('history', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  title: text('title').notNull(),
  tags: text('tags', { mode: 'json' }).notNull().default('[]'),
  sessionData: text('session_data', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull().default(sql`datetime('now')`),
});
```

#### 1.3 Database Configuration

```typescript
// db/index.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('data/research.db');
export const db = drizzle(sqlite, { schema });

// Migrations setup
export function runMigrations() {
  // Run initial schema creation
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (...)
    CREATE TABLE IF NOT EXISTS knowledge (...)
    -- etc
  `);
}
```

### Phase 2: Manager Refactoring

#### 2.1 Database-Backed UserManager

```typescript
export class UserManager {
  static async register(email?: string, settings?: Partial<UserSettings>): Promise<AuthResponse> {
    const userId = generateApiKey();
    const now = new Date().toISOString();
    
    await db.insert(users).values({
      id: userId,
      email,
      settings: { ...defaultSettings, ...settings },
      createdAt: now,
      updatedAt: now,
    });

    return { userId, apiKey: userId, expiresAt: /* ... */ };
  }

  static async get(userId: string): Promise<UserProfile | null> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user[0] || null;
  }

  // ... other methods
}
```

#### 2.2 Database-Backed KnowledgeManager

```typescript
export class KnowledgeManager {
  static async create(data: CreateKnowledgeData): Promise<KnowledgeResponse> {
    const knowledge = await db.insert(knowledge).values({
      id: nanoid(),
      ...data,
    }).returning();
    
    return knowledge[0];
  }

  static async list(userId?: string): Promise<KnowledgeResponse[]> {
    let query = db.select().from(knowledge);
    if (userId) {
      query = query.where(eq(knowledge.userId, userId));
    }
    return await query;
  }

  // ... other methods
}
```

#### 2.3 Database-Backed HistoryManager & SessionManager

Similar patterns for history and session management with proper SQL queries.

### Phase 3: Migration Strategy

#### 3.1 Gradual Migration Approach

1. **Parallel Implementation**: Keep existing managers, add database versions
2. **Feature Flag**: Environment variable to switch between storage types
3. **Testing**: Comprehensive tests for database operations
4. **Cutover**: Switch to database storage once validated

#### 3.2 Development Workflow

```typescript
// utils/api/storage-factory.ts
export function getStorageType(): 'memory' | 'database' {
  return process.env.STORAGE_TYPE === 'database' ? 'database' : 'memory';
}

export function getUserManager(): UserManager {
  return getStorageType() === 'database' 
    ? new DatabaseUserManager() 
    : new InMemoryUserManager();
}
```

### Phase 4: Testing & Validation

#### 4.1 Database Testing

- **Unit Tests**: Each manager with SQLite in-memory mode
- **Integration Tests**: Full API workflows with real database
- **Performance Tests**: Query performance and connection handling
- **Migration Tests**: Data integrity during storage type switches

#### 4.2 Edge Runtime Compatibility

- **SQLite Compatibility**: Verify better-sqlite3 works in Edge Runtime
- **File System Access**: Ensure database file can be created/accessed
- **Connection Pooling**: Handle concurrent requests properly

### Phase 5: Deployment & Production

#### 5.1 Database File Management

- **Location**: `./data/research.db` (gitignored)
- **Backups**: Regular database backups in production
- **Migrations**: Version-controlled schema changes

#### 5.2 Performance Optimizations

- **Indexes**: Key indexes for user lookups, knowledge queries, history searches
- **Connection Management**: Single connection with proper locking
- **Query Optimization**: Efficient queries for list/search operations

## Implementation Timeline

### Week 1: Database Foundation

- [ ] Setup Drizzle ORM and SQLite dependencies
- [ ] Design and implement database schema
- [ ] Create migration system
- [ ] Basic database connection and operations

### Week 2: Manager Refactoring  

- [ ] Implement DatabaseUserManager
- [ ] Implement DatabaseKnowledgeManager
- [ ] Implement DatabaseHistoryManager
- [ ] Update DatabaseSessionManager

### Week 3: Integration & Testing

- [ ] Update API endpoints to use database managers
- [ ] Comprehensive testing suite
- [ ] Performance testing and optimization
- [ ] Edge Runtime compatibility validation

### Week 4: Migration & Deployment

- [ ] Migration strategy implementation
- [ ] Production deployment preparation
- [ ] Documentation and monitoring
- [ ] Final validation and cutover

## Success Criteria

### Technical Metrics

- **100% API Success Rate**: All endpoints work reliably
- **Data Persistence**: User registration → profile retrieval works
- **Performance**: <100ms database query response times
- **Edge Runtime Compatibility**: Works in Vercel Edge Runtime

### Feature Parity Metrics

- **Complete CRUD**: All user, knowledge, history, session operations
- **Search Functionality**: Tag-based history search, knowledge filtering
- **Export Features**: JSON, Markdown, CSV exports from database
- **Resource Management**: Knowledge attachment to sessions

### User Experience

- **Zero Data Loss**: Reliable data persistence between requests
- **Fast Responses**: No noticeable performance degradation
- **Consistent Behavior**: Same functionality as client-side stores

## Risk Mitigation

### Technical Risks

- **Edge Runtime Limitations**: Test SQLite compatibility early
- **File System Access**: Ensure database file can be written in deployment
- **Concurrent Access**: Implement proper database locking

### Migration Risks

- **Data Loss**: Thorough testing of migration scripts
- **Downtime**: Implement zero-downtime migration strategy
- **Rollback Plan**: Ability to revert to in-memory storage if needed

## Conclusion

This SQLite + Drizzle implementation solves the fundamental Edge Runtime isolation issue and provides a solid foundation for the Deep Research API. The approach is:

- **Production-Ready**: Proper database persistence
- **Scalable**: SQLite handles the current requirements efficiently  
- **Maintainable**: Drizzle ORM provides type-safe database operations
- **Reliable**: Eliminates storage isolation problems entirely

Once implemented, this will achieve **100% feature parity** with the main application and provide a robust API foundation for future development.
