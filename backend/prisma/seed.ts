/**
 * Seed: creates a demo user and a demo agent with a couple of documents so the
 * platform works out of the box. Idempotent — running it again does not
 * create duplicates.
 *
 * Run: npm run seed  (in Docker — automatically from entrypoint.sh).
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { chunkText } from '../src/documents/chunking';

const prisma = new PrismaClient();

// Local embeddings (same approach as in the service at runtime).
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
  console.log(`  • ${filename}: ${chunks.length} chunks`);
}

// ── Demo knowledge base ─────────────────────────────────────────────────────
// The demo documents live as plain Markdown next to this script, in
// prisma/seed-docs/. Keeping them as files rather than inline template literals
// means the knowledge base can grow without turning seed.ts into a wall of text,
// and the same files are readable on GitHub.
//
// Size matters here: first-pass retrieval returns TOP_K = 4 chunks, so a base of
// only a few chunks would always be retrieved in full and the agent would never
// need its search_knowledge_base tool. With this document set the base is well
// past that threshold, which is what makes the multi-step tool-calling path
// (and the agent step timeline in the UI) actually reachable.
const SEED_DOCS_DIR = path.join(process.cwd(), 'prisma', 'seed-docs');

function loadSeedDocs(): { filename: string; text: string }[] {
  if (!fs.existsSync(SEED_DOCS_DIR)) {
    console.warn(`Seed: ${SEED_DOCS_DIR} not found — no demo documents to index.`);
    return [];
  }
  return fs
    .readdirSync(SEED_DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((filename) => ({
      filename,
      text: fs.readFileSync(path.join(SEED_DOCS_DIR, filename), 'utf8'),
    }));
}

async function main() {
  console.log('Seed: starting...');

  const email = 'demo@aiap.dev';
  const password = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password, name: 'Demo User' },
  });
  console.log(`User: ${email} / demo1234`);

  // If the demo agent already exists, treat the seed as done and exit.
  const existing = await prisma.agent.findFirst({
    where: { userId: user.id, name: 'Product Assistant' },
  });
  if (existing) {
    console.log('Demo agent already exists — skipping indexing.');
    return;
  }

  const agent = await prisma.agent.create({
    data: {
      userId: user.id,
      name: 'Product Assistant',
      description: 'Answers questions about the platform from uploaded documents.',
      systemPrompt:
        'You are a friendly product assistant for AI Agent Platform. ' +
        'Answer concisely, in English, based on the knowledge base and cite sources [1], [2].',
    },
  });
  console.log(`Agent created: ${agent.name}`);

  console.log('Indexing documents (computing embeddings, please wait)...');
  const docs = loadSeedDocs();
  for (const doc of docs) {
    await ingest(agent.id, doc.filename, 'text/markdown', doc.text);
  }

  console.log('Seed: done ✓');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
