import { Injectable, Logger } from '@nestjs/common';

/**
 * Считает эмбеддинги ЛОКАЛЬНО через @xenova/transformers (Transformers.js).
 * Модель all-MiniLM-L6-v2 → вектор размерности 384.
 *
 * Почему локально, а не через API: Groq отдаёт только LLM-инференс и
 * function-calling, эндпоинта эмбеддингов у него нет. Локальная модель
 * избавляет от второго платного ключа и работает оффлайн (после того, как
 * веса ~90 МБ скачались один раз и легли в кэш).
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private extractorPromise: Promise<any> | null = null;
  readonly dim = 384;

  // @xenova/transformers — ESM-only пакет. Чтобы tsc (target CommonJS) не
  // превратил import() в require() и не сломал загрузку ESM, прячем импорт
  // за new Function — он остаётся настоящим динамическим import во время рантайма.
  private async loadExtractor(): Promise<any> {
    if (!this.extractorPromise) {
      const modelName =
        process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
      this.logger.log(`Загрузка модели эмбеддингов: ${modelName} ...`);
      const dynamicImport = new Function('m', 'return import(m)');
      this.extractorPromise = dynamicImport('@xenova/transformers').then(
        (mod: any) => mod.pipeline('feature-extraction', modelName),
      );
    }
    return this.extractorPromise;
  }

  /** Эмбеддинг одного текста → number[] длины 384 (нормализованный). */
  async embed(text: string): Promise<number[]> {
    const extractor = await this.loadExtractor();
    // mean pooling + L2-нормализация → сразу пригодно для косинусной близости.
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  /** Пакетный вариант — последовательно, чтобы не упереться в память. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const t of texts) {
      out.push(await this.embed(t));
    }
    return out;
  }

  /** Сериализация вектора в литерал pgvector: '[0.1,0.2,...]'. */
  toSqlVector(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
