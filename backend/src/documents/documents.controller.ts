import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('agents/:agentId/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('agentId') agentId: string) {
    return this.documents.list(user.userId, agentId);
  }

  // multipart/form-data, field "file". The file stays in memory (memoryStorage by default).
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('agentId') agentId: string,
    @UploadedFile() file: any,
  ) {
    return this.documents.upload(user.userId, agentId, file);
  }

  @Delete(':documentId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('agentId') agentId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.remove(user.userId, agentId, documentId);
  }
}
