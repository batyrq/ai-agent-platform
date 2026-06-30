import { Global, Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { RetrievalService } from './retrieval.service';

// Global — эмбеддинги и поиск нужны и documents, и chat.
@Global()
@Module({
  providers: [EmbeddingsService, RetrievalService],
  exports: [EmbeddingsService, RetrievalService],
})
export class RagModule {}
