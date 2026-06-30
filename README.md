# AI Agent Platform

Платформа для создания AI-агентов с собственной базой знаний. Пользователь
создаёт агента, загружает документы, и агент отвечает в чате, опираясь на эти
документы и **приводя цитаты на источники**. Под капотом — мульти-шаговый
RAG-пайплайн: векторный поиск по pgvector → tool-calling через Groq → синтез
ответа со ссылками. Каждый шаг агента виден в интерфейсе.

Поднимается одной командой через Docker Compose.

---

## Стек

| Слой        | Технология                                                    |
|-------------|---------------------------------------------------------------|
| Frontend    | Next.js 14 (App Router) + TypeScript + Tailwind               |
| Backend     | NestJS 10 + Prisma 5                                           |
| База данных | PostgreSQL 16 + **pgvector** (векторный поиск)                |
| LLM         | **Groq** (Llama 3.3 70B) + function-calling                   |
| Оркестрация | **LangGraph** (граф `retrieve → agent → tools`)               |
| Эмбеддинги  | `@xenova/transformers`, all-MiniLM-L6-v2, **локально**, 384-d |

> Почему эмбеддинги локальные: у Groq нет эндпоинта эмбеддингов (только
> LLM-инференс и tool-calling). Локальная модель снимает необходимость во
> втором платном ключе — нужен только бесплатный ключ Groq для генерации.

---

## Быстрый старт

Нужен только установленный **Docker** (с Docker Compose).

```bash
# 1. Скопировать конфиг и вписать бесплатный ключ Groq
cp .env.example .env
#   → открыть .env и заменить GROQ_API_KEY на ключ из https://console.groq.com/keys

# 2. Поднять весь стек
docker compose up -d --build

# 3. Открыть в браузере
#    Frontend:  http://localhost:3000
#    Backend:   http://localhost:4000/health
```

Первый старт дольше обычного: backend качает модель эмбеддингов (~90 МБ) и
индексирует демо-документы (seed). За статусом можно следить так:

```bash
docker compose ps          # должны быть healthy
docker compose logs -f backend
```

### Демо-доступ (создаётся автоматически через seed)

- **Email:** `demo@aiap.dev`
- **Пароль:** `demo1234`
- Под этим пользователем уже есть агент **«Помощник по продукту»** с двумя
  проиндексированными документами — можно сразу задавать вопросы, например:
  *«Какие модели использует платформа?»* или *«Как запустить платформу?»*.

---

## Как это работает

### RAG-пайплайн (от документа до ответа)

1. **Загрузка** (`documents.service.ts`): файл (TXT/MD/PDF) → текст.
2. **Чанкинг** (`documents/chunking.ts`): режем по абзацам/предложениям на
   куски ~900 символов с перекрытием 150 — чтобы мысль на границе не терялась.
3. **Эмбеддинги** (`rag/embeddings.service.ts`): каждый чанк → вектор 384-d
   (локальная модель, mean-pooling + L2-нормализация).
4. **Хранение** (`rag/retrieval.service.ts`): чанк + вектор пишутся в колонку
   `Chunk.embedding` типа `vector(384)` (raw SQL — Prisma не сериализует vector).
5. **Поиск**: запрос → вектор → top-k ближайших чанков по косинусному
   расстоянию (`embedding <=> query`), ускоряется HNSW-индексом.

### Граф агента (LangGraph)

Файл `chat/graph.ts`. Классический ReAct-цикл:

```
START → retrieve → agent ──(нужен инструмент?)──► tools → agent → ...
                      └──(нет)──► END
```

- **retrieve** — первичный поиск по базе знаний, кладёт контекст и цитаты.
- **agent** — вызывает Groq с привязанным инструментом `search_knowledge_base`.
  Модель либо отвечает финальным текстом, либо просит вызвать инструмент.
- **tools** — выполняет доп. поиск по базе и возвращает результат агенту.

Цикл ограничен `MAX_ITERATIONS`, чтобы агент не зациклился.

### Стриминг

`chat/chat.service.ts` читает из графа `streamMode: ["updates","messages"]` и
отдаёт по SSE два потока: **шаги агента** (для правой панели) и **токены
ответа** (живой текст в чате). Фронтенд (`lib/chatStream.ts`) читает поток
через `fetch` + `ReadableStream` (а не `EventSource` — нужен JWT-заголовок).

---

## Структура

```
ai-agent-platform/
├── docker-compose.yml      # postgres + backend + frontend
├── .env.example            # шаблон конфигурации
├── db/init.sql             # CREATE EXTENSION vector
├── backend/                # NestJS
│   ├── prisma/             # схема, миграции, seed
│   └── src/
│       ├── auth/           # JWT (register/login/me)
│       ├── agents/         # CRUD агентов
│       ├── documents/      # upload + чанкинг + индексация
│       ├── rag/            # эмбеддинги + векторный поиск (pgvector)
│       └── chat/           # LangGraph + Groq + SSE
└── frontend/               # Next.js (дашборд, чат, шаги, документы)
```

---

## API (вкратце)

| Метод | Путь                                  | Описание                       |
|-------|---------------------------------------|--------------------------------|
| POST  | `/auth/register` · `/auth/login`      | регистрация / вход (JWT)       |
| GET   | `/agents`                             | список агентов                 |
| POST  | `/agents`                             | создать агента                 |
| POST  | `/agents/:id/documents`              | загрузить документ (multipart) |
| POST  | `/agents/:id/chat`                    | чат (SSE-стрим)                |
| GET   | `/agents/:id/chat/history`            | история диалога                |

Все эндпоинты, кроме `auth`, требуют заголовок `Authorization: Bearer <token>`.

---

## Локальная разработка (без Docker)

```bash
# Postgres всё равно проще через Docker:
docker compose up -d postgres

# Backend
cd backend
npm install
export DATABASE_URL="postgresql://aiap:aiap_password@localhost:5433/aiap?schema=public"
npx prisma migrate deploy
npm run seed
npm run start:dev          # http://localhost:4000

# Frontend (в другом терминале)
cd frontend
npm install
npm run dev                # http://localhost:3000
```

---

## Частые проблемы

- **Чат отвечает ошибкой про GROQ_API_KEY** — не вписан/неверный ключ в `.env`.
  Возьми бесплатный на https://console.groq.com/keys и пересоздай backend:
  `docker compose up -d --build backend`.
- **Порт 5432 занят** — локально уже крутится Postgres. Поменяй `POSTGRES_PORT`
  в `.env` (по умолчанию здесь `5433`); на внутреннюю сеть это не влияет.
- **Первый ответ медленный** — backend догружает модель эмбеддингов. Дальше быстро.
```
