-- 001_initial_schema.sql (generated from schema.sql)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(255) PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);

-- Vector clocks
CREATE TABLE IF NOT EXISTS vector_clocks (
  document_id VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  clock_value BIGINT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, client_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vector_clocks_document_id ON vector_clocks(document_id);
CREATE INDEX IF NOT EXISTS idx_vector_clocks_updated_at ON vector_clocks(updated_at DESC);

-- Deltas
CREATE TABLE IF NOT EXISTS deltas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  field_path VARCHAR(500) NOT NULL,
  value JSONB,
  clock_value BIGINT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deltas_document_id ON deltas(document_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_deltas_timestamp ON deltas(timestamp DESC);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  client_id VARCHAR(255),
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen DESC);

-- Triggers, functions, views etc are intentionally omitted here and can be added in follow-up migrations.