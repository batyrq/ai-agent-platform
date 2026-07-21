import { Injectable, Logger } from '@nestjs/common';

/**
 * Computes embeddings LOCALLY via @xenova/transformers (Transformers.js).
 * The all-MiniLM-L6-v2 model → a 384-dimensional vector.
 *
 * Why local instead of an API: Groq only offers LLM inference and
 * function-calling, it has no embeddings endpoint. A local model
 * removes the need for a second paid key and works offline (once the
 * ~90 MB weights have been downloaded and cached).
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private extractorPromise: Promise<any> | null = null;
  readonly dim = 384;

  // @xenova/transformers is an ESM-only package. To stop tsc (target CommonJS)
  // from rewriting import() into require() and breaking the ESM load, the import
  // is hidden behind new Function — it stays a real dynamic import at runtime.
  private async loadExtractor(): Promise<any> {
    if (!this.extractorPromise) {
      const modelName =
        process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
      this.logger.log(`Loading embedding model: ${modelName} ...`);
      const dynamicImport = new Function('m', 'return import(m)');
      this.extractorPromise = dynamicImport('@xenova/transformers').then(
        (mod: any) => mod.pipeline('feature-extraction', modelName),
      );
    }
    return this.extractorPromise;
  }

  /** Embedding of a single text → a normalized number[] of length 384. */
  async embed(text: string): Promise<number[]> {
    const extractor = await this.loadExtractor();
    // mean pooling + L2 normalization → ready for cosine similarity as-is.
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  /** Batch variant — sequential, to avoid running out of memory. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const t of texts) {
      out.push(await this.embed(t));
    }
    return out;
  }

  /** Serializes a vector into a pgvector literal: '[0.1,0.2,...]'. */
  toSqlVector(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
