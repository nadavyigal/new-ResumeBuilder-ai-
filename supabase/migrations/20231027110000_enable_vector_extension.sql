-- Migration: Enable pgvector extension
-- Purpose: Ensure vector type is available before tables use embeddings
-- Created: 2023-10-27 11:00:00

CREATE EXTENSION IF NOT EXISTS vector;
