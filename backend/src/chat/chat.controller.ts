import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('agents/:agentId/chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Param('agentId') agentId: string) {
    return this.chat.getHistory(user.userId, agentId);
  }

  // SSE stream. The frontend reads the response via fetch + ReadableStream
  // (not EventSource), so it can send an Authorization header.
  // BYOK: the client passes the Groq key in the x-groq-key header.
  // It is not stored on the server — only forwarded into the Groq call.
  @Post()
  async send(
    @CurrentUser() user: AuthUser,
    @Param('agentId') agentId: string,
    @Body() dto: ChatMessageDto,
    @Headers('x-groq-key') groqKey: string,
    @Res() res: Response,
  ) {
    await this.chat.streamChat(user.userId, agentId, dto.message, res, groqKey);
  }
}
