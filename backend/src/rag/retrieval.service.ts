import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from './embeddings.service';

export interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  filename: string;
  // Косинусная близость в [0..1], чем больше — тем релевантнее.
  score: number;
}

/**
 * Векторный поиск по pgvector.
 *
 * Хранение: эмбеддинги лежат в колонке Chunk.embedding типа vector(384).
 * Prisma Client не умеет писать/читать vector, поэтому здесь — только raw SQL.
 *
 * Поиск: оператор `<=>` из pgvector считает косинусное РАССТОЯНИЕ
 * (0 = идентичны). Близость = 1 - расстояние. Сортируем по возрастанию
 * расстояния и берём top-k. На объёмах демо точный перебор работает мгновенно;
 * под нагрузкой сюда добавляется ANN-индекс (ivfflat/hnsw) — см. README.
 */
@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Записать чанк вместе с его эмбеддингом (raw SQL из-за типа vector). */
  async insertChunk(params: {
    id: string;
    agentId: string;
    documentId: string;
    content: string;
    chunkIndex: number;
    embedding: number[];
  }): Promise<void> {
    const vec = this.embeddings.toSqlVector(params.embedding);
    // $executeRaw с параметрами — защита от SQL-инъекций; вектор кастуем к ::vector.
    await this.prisma.$executeRaw`
      INSERT INTO "Chunk" ("id", "agentId", "documentId", "content", "chunkIndex", "embedding", "createdAt")
      VALUES (${params.id}, ${params.agentId}, ${params.documentId}, ${params.content}, ${params.chunkIndex}, ${vec}::vector, NOW())
    `;
  }

  /** Top-k чанков агента, ближайших к запросу. */
  async search(
    agentId: string,
    query: string,
    k = 4,
  ): Promise<RetrievedChunk[]> {
    const queryVec = this.embeddings.toSqlVector(
      await this.embeddings.embed(query),
    );

    // JOIN к Document, чтобы вернуть имя файла для цитаты.
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
