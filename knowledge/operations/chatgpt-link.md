# ChatGPT link operations

Set `CHATGPT_LINK_ENABLED=false` and restart the backend to block new linking
and provider work at the client boundary. This does not abort an in-flight
upstream call. Re-enable and restart to restore access.

`PROVIDER_CREDENTIAL_ENCRYPTION_KEYS` is a shared ordered Fernet keyring.
Prepend a new key while retaining every old key: new writes use the first,
existing rows can still decrypt with the others. There is no bulk re-encryption
command. Remove an old key only after all affected credentials have been
rewritten and verified. Keep database backups separate from the environment
secret store; a database dump plus the keyring defeats encryption at rest.

Linking requires provider consent and a successful proof stream completion;
HTTP 200 alone does not prove access. Unknown proof errors remain retryable
and do not create a working link. Never log tokens or credential plaintext.
Learners reconnect through the Account page; there is no administrator
credential-reissue API. Preserve the explicit provider User-Agent and encoding
boundaries: initial token exchange is form-encoded, renewal is JSON.

Refresh-token replacement commits before provider transport resumes, using
an independent session so later business rollback cannot undo rotation.
A renewal without a replacement refresh token preserves the old one.
Permanent renewal failures mark the link broken. Link polling commits the
new link before revoking a superseded credential; ambiguous commit outcomes
must not trigger blind revocation of a possibly persisted replacement.

Disconnect best-effort revokes the upstream grant, deletes its row, commits,
then best-effort clears Redis authorization state. Account deletion captures
the credential in its transaction and revokes it after commit; cleanup failures
are logged without undoing the deletion. Neither path requires the provider
to be reachable, and no bulk disposal operation is shipped.

The linked ChatGPT provider is one of the configured external AI providers
that may process a learner's chatbot message, bounded recent history, and
current page context to produce the requested reply. The learner can remove
the link from Account; deleting the Flyt account removes the stored link in the
account transaction and attempts upstream revocation after that commit.
