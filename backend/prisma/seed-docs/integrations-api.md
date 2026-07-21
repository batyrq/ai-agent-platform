AI Agent Platform — Integrations and Public API

REST API. Every action available in the dashboard is also available through the
public REST API. The base URL is https://api.example.com/v1 and all requests are
authenticated with a bearer token. Responses are JSON and use conventional HTTP
status codes.

Creating an agent programmatically. POST /v1/agents with a name, an optional
description, and an optional system prompt returns the created agent object with
its identifier. Uploading a document is a multipart POST to
/v1/agents/{id}/documents. Indexing is asynchronous: the response returns
immediately with a document identifier, and the chunk count is populated once
embedding finishes.

Rate limits. The public API allows sixty requests per minute per token on the
Free plan, six hundred requests per minute on the Pro plan, and three thousand
requests per minute on the Business plan. Exceeding the limit returns HTTP 429
with a Retry-After header expressed in seconds. Streaming chat responses count as
a single request regardless of how many tokens are produced.

Pagination. List endpoints return at most fifty items per page and use cursor
pagination. Pass the next_cursor value from the previous response as the cursor
query parameter to fetch the following page.

Webhooks. A workspace can register webhook endpoints that receive events when a
document finishes indexing, when a conversation ends, or when an agent is
deleted. Payloads are signed with an HMAC-SHA256 signature in the
X-Signature header, and the signing secret is shown once at creation time.
Failed deliveries are retried with exponential backoff for up to twenty-four
hours.

Slack integration. The Slack app lets a workspace query any agent with a slash
command. Answers are posted back into the channel with their citations rendered
as links to the source documents. The Slack app requires the chat:write and
commands OAuth scopes.

Zapier and automation. A Zapier connector exposes two triggers, document indexed
and conversation completed, and two actions, ask agent and upload document. This
is the fastest route to connecting the platform to tools that lack a native
integration.

Embedding the widget. A read-only chat widget can be embedded into an external
site with a single script tag. The widget authenticates with a public,
domain-restricted token rather than a full API token.
