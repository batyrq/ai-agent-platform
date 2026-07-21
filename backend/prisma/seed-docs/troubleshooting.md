AI Agent Platform — Troubleshooting Guide

The agent answers that it does not know. This almost always means retrieval
returned nothing useful rather than that the model failed. Confirm the document
shows a chunk count above zero in the knowledge base panel. A chunk count of zero
means indexing failed, usually because the uploaded PDF contained scanned images
rather than a text layer. The platform does not perform optical character
recognition, so scanned documents must be converted to text first.

Uploads fail with an empty document error. The extractor found no text in the
file. For PDFs this points to a scan-only document. For Markdown and plain text
files it usually means the file was saved in an encoding other than UTF-8.

Answers arrive without citations. Citations are produced only when the retrieval
step returns chunks. If the knowledge base is empty, the model still answers from
its general knowledge and no citations appear. Upload at least one document to
the agent to restore grounded answers.

Chat returns an authentication error from the model provider. The supplied model
API key was rejected. Keys are validated only at call time, so an expired or
revoked key surfaces as a chat error rather than a login error. Paste a fresh key
in Settings, and remember that a key stored in the browser overrides the key
configured on the server.

Indexing is very slow on first use. The first upload after a restart downloads
the local embedding model, which is roughly ninety megabytes. Subsequent uploads
reuse the cached model and are much faster. Mounting a persistent cache volume
avoids repeating the download on every deployment.

Search returns irrelevant chunks. The default retrieval depth is four chunks. For
long and diverse knowledge bases, a single retrieval pass may miss the relevant
section, in which case the agent issues an additional tool-based search. If
results remain poor, split very large documents into focused files so that each
chunk covers one topic.

Port already in use on local startup. The frontend defaults to port 3000 and the
backend to port 4000. Override them with the FRONTEND_PORT and BACKEND_PORT
environment variables when another service already occupies those ports.
