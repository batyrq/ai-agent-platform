AI Agent Platform — Data Import, Export and Migration

Supported upload formats. The importer accepts plain text, Markdown, and PDF.
Markdown is treated as plain text for chunking purposes: headings are preserved
in the chunk body so that a retrieved fragment still shows which section it came
from. Word documents and spreadsheets are not accepted directly and must be
converted first.

Upload size limits. A single uploaded file may be at most twenty megabytes. Files
larger than that should be split by section before uploading, which also improves
retrieval quality because each chunk stays topically focused.

Bulk import. A whole folder can be imported through the command line importer,
which walks a directory, skips unsupported extensions, and uploads the remainder
sequentially. Sequential upload is intentional: embedding is CPU bound, and
parallel uploads simply queue behind each other while making progress harder to
read.

Deduplication. The importer does not deduplicate by content. Uploading the same
file twice produces two documents and two sets of chunks, which then compete for
the same retrieval slots and dilute the results. Remove the older duplicate
rather than leaving both in place.

Export. Everything a workspace owns can be exported as a single JSON archive
containing agents, their system prompts, document metadata, extracted text, and
full conversation history. Embeddings are deliberately excluded from the export
because they are derived data and are tied to a specific embedding model version.
Re-importing an archive regenerates the vectors from the exported text.

Conversation export. Conversation history can be exported separately as either
JSON or CSV. The CSV form flattens each message to one row and includes the
citation filenames as a semicolon separated column, which makes it convenient for
reviewing answer quality in a spreadsheet.

Migrating between deployments. To move a workspace from one deployment to
another, export the archive, stand up the target deployment with the same
embedding model, and re-import. Using a different embedding model on the target
is allowed but forces a full reindex, and retrieval quality should be re-checked
afterwards because chunk neighbourhoods will differ.

Retention of exports. Generated export archives are stored for seven days and are
downloadable through a signed link that expires after twenty-four hours. Export
generation is asynchronous and the requester is emailed when the archive is
ready.

Deleting data. Deleting a document removes its chunks immediately and the
citations that referenced it stop resolving, although past conversation text is
preserved as written. Deleting an agent removes its documents, chunks, and
conversations together in a single cascading operation.
