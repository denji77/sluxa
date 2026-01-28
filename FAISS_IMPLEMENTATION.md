# FAISS RAG Implementation Plan for Slusha WebApp

## Overview

This document outlines the implementation of a RAG (Retrieval-Augmented Generation) system using FAISS for semantic memory in the Slusha character AI chat application.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENHANCED CHAT FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Message                                                                │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────┐                                                        │
│  │ Generate        │◄─── Google Embedding API (text-embedding-004)          │
│  │ Embedding       │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐      ┌─────────────────┐                              │
│  │ Query FAISS     │─────►│ FAISS Index     │ (Per-chat vector store)      │
│  │ for Similar     │      │ .faiss files    │                              │
│  │ Messages        │◄─────│                 │                              │
│  └────────┬────────┘      └─────────────────┘                              │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────┐                               │
│  │ Context Assembly:                        │                               │
│  │  • Character description                 │                               │
│  │  • Top-K relevant past messages (FAISS)  │                               │
│  │  • Last 5 recent messages (recency)      │                               │
│  │  • Current user message                  │                               │
│  └────────┬────────────────────────────────┘                               │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                        │
│  │ Gemini API      │───► AI Response                                        │
│  │ Generate        │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐      ┌─────────────────┐                              │
│  │ Store Message   │─────►│ SQLite DB       │ (Messages table)             │
│  │ + Embedding     │─────►│ FAISS Index     │ (Update vectors)             │
│  └─────────────────┘      └─────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
backend/
├── app/
│   ├── ai/
│   │   ├── chat.py           # Modified - integrate RAG context
│   │   ├── prompts.py        # Existing
│   │   └── embeddings.py     # NEW - Embedding generation
│   ├── rag/
│   │   ├── __init__.py       # NEW
│   │   ├── vector_store.py   # NEW - FAISS operations
│   │   ├── memory.py         # NEW - Memory management
│   │   └── retriever.py      # NEW - Context retrieval logic
│   ├── models.py             # Modified - Add embedding metadata
│   ├── config.py             # Modified - RAG settings
│   └── routers/
│       └── chat.py           # Modified - Integrate RAG
├── data/
│   └── faiss_indexes/        # NEW - Store FAISS index files
│       └── chat_{id}/
│           ├── index.faiss
│           └── metadata.json
└── requirements.txt          # Modified - Add faiss-cpu, numpy
```

---

## Implementation Steps

### Phase 1: Dependencies & Configuration

1. **Update requirements.txt**
   - Add `faiss-cpu==1.7.4`
   - Add `numpy>=1.24.0`

2. **Update config.py**
   - Add RAG-specific settings:
     - `rag_enabled: bool = True`
     - `embedding_model: str = "text-embedding-004"`
     - `rag_top_k: int = 5` (number of similar messages to retrieve)
     - `rag_similarity_threshold: float = 0.7`
     - `rag_recent_messages: int = 5` (always include last N messages)

### Phase 2: Embedding System

3. **Create embeddings.py**
   - Function to generate embeddings using Google's text-embedding-004
   - Batch embedding support for efficiency
   - Caching layer to avoid re-embedding same content

### Phase 3: Vector Store

4. **Create vector_store.py**
   - `FAISSVectorStore` class:
     - `create_index(chat_id)` - Initialize new FAISS index
     - `add_message(chat_id, message_id, content, embedding)` - Add vector
     - `search(chat_id, query_embedding, top_k)` - Find similar
     - `delete_message(chat_id, message_id)` - Remove vector
     - `save_index(chat_id)` - Persist to disk
     - `load_index(chat_id)` - Load from disk

### Phase 4: Memory Manager

5. **Create memory.py**
   - `MemoryManager` class:
     - Coordinates between SQLite and FAISS
     - Handles embedding generation + storage
     - Provides unified interface for chat context

### Phase 5: Retriever

6. **Create retriever.py**
   - `ContextRetriever` class:
     - `get_relevant_context(chat_id, user_message)` - Main method
     - Combines: RAG results + recent messages + character info
     - Deduplication logic
     - Relevance scoring and filtering

### Phase 6: Integration

7. **Modify chat.py (AI)**
   - Update `generate_response()` to use RAG context
   - Fallback to full history if RAG disabled

8. **Modify chat.py (Router)**
   - After saving message, trigger embedding + FAISS update
   - On chat delete, cleanup FAISS index

9. **Modify models.py**
   - Add `MessageEmbedding` table (optional, for tracking):
     - `message_id` (FK)
     - `embedding_generated_at`
     - `model_version`

---

## Database Schema Changes

### New Table: message_embeddings (Optional Tracking)

```sql
CREATE TABLE message_embeddings (
    id INTEGER PRIMARY KEY,
    message_id INTEGER UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    embedding_model VARCHAR(50),
    embedding_dim INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Note: Actual embeddings stored in FAISS files, not in SQLite (binary blob too large).

---

## API Changes

### No External API Changes Required

The RAG system is internal - the existing API endpoints remain the same:
- `POST /chats/{chat_id}/messages` - Now uses RAG internally
- `DELETE /chats/{chat_id}` - Now cleans up FAISS index

### New Internal Config Endpoint (Optional)

```
GET /config/rag
{
  "enabled": true,
  "top_k": 5,
  "similarity_threshold": 0.7
}

PATCH /config/rag
{
  "enabled": false
}
```

---

## Configuration Options

```python
# .env additions
RAG_ENABLED=true
RAG_TOP_K=5
RAG_SIMILARITY_THRESHOLD=0.7
RAG_RECENT_MESSAGES=5
EMBEDDING_MODEL=text-embedding-004
FAISS_INDEX_PATH=./data/faiss_indexes
```

---

## Performance Considerations

### Embedding Latency
- Google's text-embedding-004: ~100-200ms per request
- Mitigation: Async embedding, batch processing

### FAISS Search Speed
- FAISS IndexFlatIP: O(n) but very fast for small indexes
- Each chat typically < 10,000 messages = sub-millisecond search

### Memory Usage
- 768-dim embeddings (text-embedding-004)
- ~3KB per message embedding
- 1000 messages ≈ 3MB per chat index

### Disk Storage
- FAISS indexes saved as `.faiss` files
- Metadata stored as JSON sidecars
- Automatic cleanup on chat deletion

---

## Error Handling

1. **Embedding API Failure**
   - Fallback to recent-only context
   - Log error, don't block message sending

2. **FAISS Index Corruption**
   - Auto-rebuild from SQLite messages
   - Scheduled integrity checks

3. **Missing Index**
   - Lazy initialization on first message
   - Background job to index existing chats

---

## Migration Strategy

### For Existing Chats

1. **Background Job**: `index_existing_chats()`
   - Iterate all chats without FAISS index
   - Generate embeddings for all messages
   - Build FAISS index
   - Rate-limited to avoid API quotas

2. **Lazy Indexing**:
   - If chat accessed but no index exists
   - Build index on-demand (first retrieval slower)

---

## Testing Plan

1. **Unit Tests**
   - `test_embeddings.py` - Embedding generation
   - `test_vector_store.py` - FAISS operations
   - `test_retriever.py` - Context assembly

2. **Integration Tests**
   - Full message flow with RAG
   - Chat deletion cleanup
   - Index persistence/recovery

3. **Performance Tests**
   - Latency with RAG vs without
   - Memory usage under load
   - Index size growth

---

## Rollout Plan

### Step 1: Feature Flag
- `RAG_ENABLED=false` by default
- Test with specific users/chats

### Step 2: Gradual Enable
- Enable for new chats only
- Monitor performance metrics

### Step 3: Full Rollout
- Enable for all chats
- Background index existing conversations

---

## Implementation Order

```
[x] 1. Create this implementation document
[x] 2. Update requirements.txt (added faiss-cpu, numpy)
[x] 3. Update config.py with RAG settings
[x] 4. Create ai/embeddings.py
[x] 5. Create rag/vector_store.py
[x] 6. Create rag/memory.py
[x] 7. Create rag/retriever.py
[x] 8. Modify ai/chat.py (added rag_context parameter)
[x] 9. Modify routers/chat.py (full RAG integration)
[x] 10. Add RAG stats and reindex endpoints
[ ] 11. Install dependencies and test
```

---

## Estimated Time

| Task | Estimate |
|------|----------|
| Dependencies & Config | 10 min |
| Embeddings Module | 20 min |
| Vector Store | 30 min |
| Memory Manager | 20 min |
| Retriever | 20 min |
| Integration | 30 min |
| Testing | 30 min |
| **Total** | **~2.5 hours** |

---

## Let's Begin Implementation! 🚀
