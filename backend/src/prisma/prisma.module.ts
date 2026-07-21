import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global so PrismaService can be injected into any module without re-importing.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
