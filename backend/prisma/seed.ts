/**
 * Seed: создаёт демо-пользователя и демо-агента с парой документов,
 * чтобы платформа работала «из коробки». Идемпотентен — повторный запуск
 * не плодит дубликаты.
 *
 * Запуск: npm run seed  (в Docker — автоматически из entrypoint.sh).
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { chunkText } from '../src/documents/chunking';

const prisma = new PrismaClient();

// Локальные эмбеддинги (тот же подход, что и в рантайме сервиса).
let extractorPromise: Promise<any> | null = null;
async function embed(text: string): Promise<number[]> {
  if (!extractorPromise) {
    const modelName = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
    const dynamicImport = new Function('m', 'return import(m)');
    extractorPromise = dynamicImport('@xenova/transformers').then((mod: any) =>
      mod.pipeline('feature-extraction', modelName),
    );
  }
  const extractor = await extractorPromise;
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

async function ingest(
  agentId: string,
  filename: string,
  mimeType: string,
  text: string,
) {
  const chunks = chunkText(text);
  const doc = await prisma.document.create({
    data: { agentId, filename, mimeType, chunkCount: chunks.length },
  });
  for (let i = 0; i < chunks.length; i++) {
    const vec = `[${(await embed(chunks[i])).join(',')}]`;
    await prisma.$executeRaw`
      INSERT INTO "Chunk" ("id","agentId","documentId","content","chunkIndex","embedding","createdAt")
      VALUES (${randomUUID()}, ${agentId}, ${doc.id}, ${chunks[i]}, ${i}, ${vec}::vector, NOW())
    `;
  }
  console.log(`  • ${filename}: ${chunks.length} чанков`);
}

// ── Демо-контент базы знаний ────────────────────────────────────────────────
const DOC_PRODUCT = `AI Agent Platform — обзор продукта

AI Agent Platform — это платформа для создания AI-агентов с собственной базой
знаний. Пользователь создаёт агента, загружает документы, и агент отвечает на
вопросы, опираясь на эти документы и приводя ссылки на источники.

Ключевые возможности:
- Создание неограниченного числа агентов, у каждого своя база знаний.
- Загрузка документов в форматах TXT, Markdown и PDF.
- Чат со стримингом ответа в реальном времени.
- Визуализация шагов агента: видно, как он ищет в базе и вызывает инструменты.
- Цитаты: каждый ответ ссылается на конкретные фрагменты документов.

Архитектура: ответ строится по схеме RAG (retrieval-augmented generation).
Сначала вопрос превращается в вектор, затем по базе знаний ищутся ближайшие
фрагменты (pgvector), после чего языковая модель синтезирует ответ с цитатами.
При необходимости агент делает дополнительные запросы к базе через инструмент
search_knowledge_base — это и есть мульти-шаговая работа агента.`;

const DOC_FAQ = `Частые вопросы (FAQ)

Вопрос: Какие модели использует платформа?
Ответ: Для генерации ответов используется Groq с моделью Llama 3.3 70B и
поддержкой function-calling. Эмбеддинги считаются локально моделью
all-MiniLM-L6-v2 (размерность 384), поэтому отдельный платный ключ для
эмбеддингов не нужен.

Вопрос: Где хранятся векторы документов?
Ответ: В PostgreSQL с расширением pgvector. Поиск ближайших фрагментов идёт по
косинусному расстоянию.

Вопрос: Как запустить платформу?
Ответ: Скопировать .env.example в .env, вписать GROQ_API_KEY и выполнить
docker compose up. Поднимутся три сервиса: база данных, бэкенд и фронтенд.

Вопрос: Что такое шаги агента?
Ответ: Это видимая трассировка работы агента — поиск в базе знаний, решение
вызвать инструмент, выполнение инструмента и финальный синтез ответа. Шаги
показываются в интерфейсе чата справа от диалога.

Вопрос: Какой демо-логин?
Ответ: Email demo@aiap.dev и пароль demo1234. Под этим пользователем уже создан
демо-агент «Помощник по продукту» с этой базой знаний.`;

async function main() {
  console.log('Seed: старт...');

  const email = 'demo@aiap.dev';
  const password = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password, name: 'Demo User' },
  });
  console.log(`Пользователь: ${email} / demo1234`);

  // Если демо-агент уже есть — считаем, что сид выполнен, выходим.
  const existing = await prisma.agent.findFirst({
    where: { userId: user.id, name: 'Помощник по продукту' },
  });
  if (existing) {
    console.log('Демо-агент уже существует — пропускаю индексацию.');
    return;
  }

  const agent = await prisma.agent.create({
    data: {
      userId: user.id,
      name: 'Помощник по продукту',
      description: 'Отвечает на вопросы о платформе по загруженным документам.',
      systemPrompt:
        'Ты — дружелюбный ассистент по продукту AI Agent Platform. ' +
        'Отвечай кратко, по-русски, опираясь на базу знаний и приводя ссылки [1], [2].',
    },
  });
  console.log(`Агент создан: ${agent.name}`);

  console.log('Индексация документов (считаются эмбеддинги, подождите)...');
  await ingest(agent.id, 'product-overview.md', 'text/markdown', DOC_PRODUCT);
  await ingest(agent.id, 'faq.md', 'text/markdown', DOC_FAQ);

  console.log('Seed: готово ✓');
}

main()
  .catch((e) => {
    console.error('Seed упал:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
