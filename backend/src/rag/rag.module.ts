import { Global, Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { RetrievalService } from './retrieval.service';

// Global — both documents and chat need embeddings and search.
@Global()
@Module({
  providers: [EmbeddingsService, RetrievalService],
  exports: [EmbeddingsService, RetrievalService],
})
export class RagModule {}
