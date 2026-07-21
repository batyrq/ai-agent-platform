-- Runs once, on the first initialization of the Postgres volume.
-- Enable the pgvector extension — it provides the `vector` type and the
-- cosine/euclidean distance operators that semantic search is built on.
CREATE EXTENSION IF NOT EXISTS vector;
