AI Agent Platform — Billing, Plans and Limits

Plan overview. There are four plans. Free is aimed at evaluation and includes one
agent, fifty megabytes of document storage, and community support only. Pro costs
twenty-nine dollars per seat per month and includes ten agents, five gigabytes of
storage, and email support with a one business day response target. Business
costs ninety-nine dollars per seat per month and includes unlimited agents, fifty
gigabytes of storage, single sign-on, and a four hour response target. Enterprise
is quoted individually and adds a dedicated tenant, custom data residency, and a
named customer success manager.

Seat definition. A seat is any user account that can sign in to the workspace.
Deactivated accounts do not consume a seat. Service accounts used purely for API
access do not consume a seat either, but each service account is limited to the
rate limit of the workspace plan.

Annual billing. Annual prepayment gives a twenty percent discount against the
monthly list price. Annual invoicing is available only for workspaces with a
minimum of twenty-five seats; smaller workspaces must pay by card. Annual
contracts renew automatically unless cancelled thirty days before the renewal
date.

Storage overage. Storage is measured as the total size of original uploaded
files, not the size of the derived chunks or their embeddings. Exceeding the plan
storage quota does not delete anything and does not block reads. New uploads are
rejected until usage falls back under the quota or the plan is upgraded. There is
no per-gigabyte overage charge on any plan.

Usage metering. Model usage is metered in tokens and billed to the customer's own
model provider account, because the platform uses a bring-your-own-key model.
The platform itself does not resell model tokens and adds no markup. This is why
there is no token line item on a platform invoice.

Trials. Every new workspace starts with a fourteen day trial of the Business
plan, with no card required. At the end of the trial the workspace downgrades to
Free automatically and any agents beyond the first are archived rather than
deleted. Archived agents become available again immediately on upgrade.

Proration and plan changes. Upgrading takes effect immediately and is prorated to
the day. Downgrading takes effect at the end of the current billing period, so no
credit is issued for the unused remainder of the period.

Taxes and invoicing. Prices exclude VAT and sales tax. A valid EU VAT number
entered in workspace settings switches the invoice to the reverse charge
mechanism. Invoices are emailed to the billing contact and are also downloadable
as PDF from the billing page for the previous twenty-four months.

Payment failures. If a card payment fails, the workspace enters a grace period of
seven days during which everything keeps working and a banner is shown to owners.
After the grace period the workspace becomes read only: existing agents can still
be queried, but uploads and agent creation are blocked until billing is fixed.
