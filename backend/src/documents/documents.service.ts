import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../rag/embeddings.service';
import { RetrievalService } from '../rag/retrieval.service';
import { AgentsService } from '../agents/agents.service';
import { chunkText } from './chunking';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly retrieval: RetrievalService,
    private readonly agents: AgentsService,
  ) {}

  /** Turns an uploaded file into text based on its mime type/extension. */
  private async extractText(file: {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
  }): Promise<string> {
    const name = (file.originalname || '').toLowerCase();
    const isPdf = file.mimetype === 'application/pdf' || name.endsWith('.pdf');

    if (isPdf) {
      // Import the parser directly (bypassing the package's index.js — it has
      // a bug where it reads a test file on require).
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      const data = await pdfParse(file.buffer);
      return data.text || '';
    }

    // .txt / .md / other text — read as UTF-8.
    return file.buffer.toString('utf-8');
  }

  /** Full pipeline: text → chunks → embeddings → write to the DB (pgvector). */
  async ingestText(
    agentId: string,
    filename: string,
    mimeType: string,
    text: string,
  ) {
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new BadRequestException('Document is empty — nothing to index');
    }

    const doc = await this.prisma.document.create({
      data: { agentId, filename, mimeType, chunkCount: chunks.length },
    });

    // Compute embeddings and write the chunks. Sequential at demo volumes;
    // under load this is where a queue/batch processing belongs.
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embeddings.embed(chunks[i]);
      await this.retrieval.insertChunk({
        id: randomUUID(),
        agentId,
        documentId: doc.id,
        content: chunks[i],
        chunkIndex: i,
        embedding,
      });
    }

    this.logger.log(
      `Document "${filename}" → ${chunks.length} chunks (agent ${agentId})`,
    );
    return doc;
  }

  async upload(
    userId: string,
    agentId: string,
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
    },
  ) {
    await this.agents.assertOwned(userId, agentId);
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }
    const text = await this.extractText(file);
    return this.ingestText(
      agentId,
      file.originalname,
      file.mimetype || 'text/plain',
      text,
    );
  }

  async list(userId: string, agentId: string) {
    await this.agents.assertOwned(userId, agentId);
    return this.prisma.document.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, agentId: string, documentId: string) {
    await this.agents.assertOwned(userId, agentId);
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, agentId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    // Chunks are removed by cascade (onDelete: Cascade in the schema).
    await this.prisma.document.delete({ where: { id: documentId } });
    return { ok: true };
  }
}
