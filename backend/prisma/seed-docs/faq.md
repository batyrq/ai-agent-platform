Frequently Asked Questions (FAQ)

Question: Which models does the platform use?
Answer: Answers are generated with Groq using the Llama 3.3 70B model with
function-calling support. Embeddings are computed locally with the
all-MiniLM-L6-v2 model (384 dimensions), so no separate paid key is needed for
embeddings.

Question: Where are document vectors stored?
Answer: In PostgreSQL with the pgvector extension. Nearest chunks are found by
cosine distance.

Question: How do I run the platform?
Answer: Copy .env.example to .env, fill in GROQ_API_KEY and run
docker compose up. Three services will start: the database, the backend and the
frontend.

Question: What are agent steps?
Answer: They are a visible trace of the agent's work — searching the knowledge
base, deciding to call a tool, running the tool and the final answer synthesis.
The steps are shown in the chat interface to the right of the conversation.

Question: What is the demo login?
Answer: Email demo@aiap.dev and password demo1234. That user already has a demo
agent called "Product Assistant" with this knowledge base.
