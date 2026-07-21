import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from './embeddings.service';

export interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  filename: string;
  // Cosine similarity in [0..1]; higher means more relevant.
  score: number;
}

/**
 * Vector search over pgvector.
 *
 * Storage: embeddings live in the Chunk.embedding column of type vector(384).
 * Prisma Client cannot read/write vector, so this file uses raw SQL only.
 *
 * Search: pgvector's `<=>` operator computes cosine DISTANCE
 * (0 = identical). Similarity = 1 - distance. We sort by ascending
 * distance and take top-k. At demo volumes an exact scan is instant;
 * under load an ANN index (ivfflat/hnsw) goes here — see README.
 */
@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Insert a chunk together with its embedding (raw SQL because of the vector type). */
  async insertChunk(params: {
    id: string;
    agentId: string;
    documentId: string;
    content: string;
    chunkIndex: number;
    embedding: number[];
  }): Promise<void> {
    const vec = this.embeddings.toSqlVector(params.embedding);
    // Parameterized $executeRaw guards against SQL injection; the vector is cast to ::vector.
    await this.prisma.$executeRaw`
      INSERT INTO "Chunk" ("id", "agentId", "documentId", "content", "chunkIndex", "embedding", "createdAt")
      VALUES (${params.id}, ${params.agentId}, ${params.documentId}, ${params.content}, ${params.chunkIndex}, ${vec}::vector, NOW())
    `;
  }

  /** The agent's top-k chunks closest to the query. */
  async search(
    agentId: string,
    query: string,
    k = 4,
  ): Promise<RetrievedChunk[]> {
    const queryVec = this.embeddings.toSqlVector(
      await this.embeddings.embed(query),
    );

    // JOIN Document to return the filename for the citation.
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        content: string;
        chunkIndex: number;
        documentId: string;
        filename: string;
        distance: number;
      }>
    >`
      SELECT c."id", c."content", c."chunkIndex", c."documentId",
             d."filename" AS "filename",
             (c."embedding" <=> ${queryVec}::vector) AS "distance"
      FROM "Chunk" c
      JOIN "Document" d ON d."id" = c."documentId"
      WHERE c."agentId" = ${agentId} AND c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> ${queryVec}::vector
      LIMIT ${k}
    `;

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      chunkIndex: r.chunkIndex,
      documentId: r.documentId,
      filename: r.filename,
      score: 1 - Number(r.distance),
    }));
  }
}
