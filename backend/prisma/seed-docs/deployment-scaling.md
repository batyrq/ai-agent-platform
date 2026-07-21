AI Agent Platform — Deployment and Scaling

Container topology. A production deployment runs three containers: the PostgreSQL
database with the pgvector extension, the NestJS backend, and the Next.js
frontend. The backend is the only service that talks to the database directly.
The frontend never holds database credentials.

Kubernetes deployment. When running on Kubernetes, the backend must be deployed
with a readiness probe pointing at the /health endpoint. A common mistake is
setting the readiness probe timeout too low: the backend downloads the local
embedding model on first boot, which can take 40 to 90 seconds on a cold node.
If the readiness probe fires before the model is loaded, Kubernetes marks the pod
as unhealthy and restarts it, producing an endless restart loop. Set
initialDelaySeconds to at least 60 for the backend deployment.

Pods restarting after a deploy. If pods keep restarting immediately after a
rollout, check these four things in order. First, confirm the database migration
job completed: the backend refuses to start when the schema version does not
match. Second, check the memory limit — the embedding model needs roughly 512 MB
of resident memory, and a 256 MB limit causes the container to be OOM-killed.
Third, verify that the pgvector extension exists in the target database, because
a missing extension makes every vector query fail at startup. Fourth, inspect the
readiness probe delay as described above.

Horizontal scaling. The backend is stateless and can be scaled to multiple
replicas behind a standard load balancer. Each replica loads its own copy of the
embedding model into memory, so plan roughly 512 MB of memory per replica. The
database is the shared bottleneck: for more than eight backend replicas, enable
connection pooling with PgBouncer in transaction mode.

Vector index tuning. The HNSW index is created automatically by the initial
migration. For knowledge bases above roughly one million chunks, increase the
ef_search parameter to trade a little latency for better recall. Rebuilding the
index requires a maintenance window because HNSW builds are not concurrent.

Backups. Take logical backups with pg_dump on a daily schedule. Vector columns
are included in a standard dump, so no special handling is required. Restoring
into a fresh database requires the pgvector extension to be installed before the
restore begins, otherwise the vector column types cannot be created.

Zero-downtime migrations. Run database migrations as a separate job before
rolling out the new backend image. The platform uses additive migrations only,
so an old backend replica can safely run against a newer schema during a rollout.
