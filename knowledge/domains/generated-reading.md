# Generated reading

Generation requests and admission/accounting are persisted in PostgreSQL; generated text and cancellation coordination are ephemeral Redis state. Admission and funded-quota refresh happen before each provider attempt, and the provider call follows the committed admission transaction.

An admission debit remains spent after provider failure, cancellation, or worker death; finalization does not refund it. A ready generated result is returned through the existing polling contract. Generation itself never consumes the lifetime reading-import quota; explicit import through reading does.

Generation owns provider execution and ephemeral output. Reading owns persistent import materialization through its public service boundary, including page reuse/fallback and final visibility.
