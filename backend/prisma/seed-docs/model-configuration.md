AI Agent Platform — Model Configuration and Tuning

Generation model. The default generation model is Llama 3.3 70B served through
Groq, selected for its function-calling support and very high token throughput.
The model identifier is configurable per deployment through the GROQ_MODEL
environment variable, so a workspace can move to a different Groq-hosted model
without any code change.

Temperature. The agent runs at a temperature of 0.3. This value was chosen
deliberately: high enough that answers read naturally, low enough that the model
reliably respects the citation format and does not invent source numbers. Values
above 0.7 noticeably increase the rate of fabricated citation indices.

Embedding model. Embeddings are produced locally by all-MiniLM-L6-v2, which
outputs 384-dimensional vectors. Running embeddings locally means a second paid
provider key is never required, and it keeps document text from leaving the
deployment during indexing. The embedding model can be swapped through the
EMBEDDING_MODEL variable, but changing it invalidates every stored vector and
requires a full reindex of all documents.

Retrieval depth. The first-pass retrieval returns the four nearest chunks by
cosine distance. Four was chosen as a balance: enough context for most direct
questions, small enough that the prompt stays cheap. When a question spans
several unrelated areas of a large knowledge base, four chunks are often not
enough, and the agent compensates by issuing its own follow-up search through the
search_knowledge_base tool rather than by silently answering from partial
context.

Recursion limit. The agent loop is capped at twenty-five graph steps and at four
tool iterations. The cap exists purely as a safety net against a model that keeps
requesting searches without converging. Hitting the cap is rare and is logged as
a warning.

Context assembly. Retrieved chunks are injected as a dedicated system message
placed immediately after the agent's own system prompt, each prefixed with its
citation index and source filename. Keeping the context in a system message
rather than a user message stops the model from treating retrieved text as
something the user said.

Prompt customisation. Each agent carries its own system prompt, editable per
agent. The platform appends its own citation instructions after the custom
prompt, so a customer-authored prompt can change tone and persona but cannot
accidentally disable citations.

Streaming. Only tokens emitted by the final synthesis node are streamed to the
client. Tokens produced while the model is deciding on a tool call are withheld,
which is why the answer appears to start slightly later on questions that require
a follow-up search.
