AI Agent Platform — Security and Compliance

Single sign-on providers. Enterprise workspaces can enable single sign-on. The
platform supports four identity providers: Okta, Microsoft Entra ID (formerly
Azure Active Directory), Google Workspace, and any generic SAML 2.0 provider.
OpenID Connect is supported for Okta and Google Workspace. SSO is configured per
workspace by an owner, and once enforced, password login is disabled for every
member of that workspace.

User provisioning. Automatic user provisioning and de-provisioning is available
through SCIM 2.0 for Okta and Microsoft Entra ID. When a user is deactivated in
the identity provider, their platform sessions are revoked within five minutes.

Encryption. All data is encrypted at rest with AES-256, including the vector
columns holding document embeddings. Traffic between clients and the platform
uses TLS 1.3. Internal traffic between the backend and the database is encrypted
with mutual TLS in managed deployments.

API key handling. The Groq API key supplied by a user in the browser is sent to
the server only as a request header for the duration of a single model call. It
is never written to the database, never written to application logs, and never
included in error reports.

Data residency. Managed workspaces can pin all data to one of three regions: the
European Union (Frankfurt), the United States (Virginia), or Australia (Sydney).
Region is chosen at workspace creation and cannot be changed afterwards without a
full export and re-import.

Retention and deletion. Deleted documents and their chunks are removed from the
primary database immediately. Encrypted backups retain deleted content for a
further thirty days, after which the backup itself expires. Deleting an agent
cascades to all of its documents, chunks, and conversation history.

Certifications. The platform is SOC 2 Type II audited on an annual cycle and is
GDPR compliant, with a data processing addendum available on request. Penetration
testing is performed twice a year by an external firm, and the summary report is
available to customers under a non-disclosure agreement.

Audit log. Every administrative action — agent creation, document upload, member
role change, SSO configuration change — is written to an immutable audit log that
is retained for one year and exportable as JSON.
