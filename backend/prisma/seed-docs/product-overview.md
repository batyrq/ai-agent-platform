AI Agent Platform — Product Overview

AI Agent Platform is a platform for building AI agents with their own knowledge
base. You create an agent, upload documents, and the agent answers questions
based on those documents while citing its sources.

Key capabilities:
- Create an unlimited number of agents, each with its own knowledge base.
- Upload documents in TXT, Markdown and PDF formats.
- Chat with the answer streamed in real time.
- Agent step visualisation: you can see it search the base and call tools.
- Citations: every answer points to specific document chunks.

Architecture: answers are produced with RAG (retrieval-augmented generation).
The question is first turned into a vector, then the nearest chunks are found in
the knowledge base (pgvector), after which the language model synthesizes an
answer with citations. When needed, the agent makes additional queries to the
base through the search_knowledge_base tool — this is what makes it multi-step.
