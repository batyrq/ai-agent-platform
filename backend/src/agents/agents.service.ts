import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/agent.dto';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { documents: true, chunks: true } },
      },
    });
  }

  async get(userId: string, id: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, userId },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { documents: true, chunks: true } },
      },
    });
    if (!agent) throw new NotFoundException('Агент не найден');
    return agent;
  }

  async create(userId: string, dto: CreateAgentDto) {
    return this.prisma.agent.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        // Если промпт не задан — берём дефолт из схемы Prisma.
        ...(dto.systemPrompt ? { systemPrompt: dto.systemPrompt } : {}),
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateAgentDto) {
    await this.get(userId, id); // проверка владения
    return this.prisma.agent.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.agent.delete({ where: { id } });
    return { ok: true };
  }

  // Используется chat/documents для проверки, что агент принадлежит юзеру.
  async assertOwned(userId: string, id: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, userId },
    });
    if (!agent) throw new NotFoundException('Агент не найден');
    return agent;
  }
}
