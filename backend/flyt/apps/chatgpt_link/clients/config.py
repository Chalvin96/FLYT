from datetime import timedelta

from flyt.apps.chatgpt_link.types import ProofVerdict

USER_AGENT = "flyt"
ORIGINATOR = "flyt"

CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
ISSUER = "https://auth.openai.com"
USERCODE_URL = f"{ISSUER}/api/accounts/deviceauth/usercode"
DEVICE_TOKEN_URL = f"{ISSUER}/api/accounts/deviceauth/token"
VERIFICATION_URL = f"{ISSUER}/codex/device"
DEVICE_REDIRECT_URI = f"{ISSUER}/deviceauth/callback"
TOKEN_URL = f"{ISSUER}/oauth/token"
REVOKE_URL = f"{ISSUER}/oauth/revoke"
RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses"

TOKEN_EXPIRY_FALLBACK = timedelta(days=8)
REVOKE_TIMEOUT_SECONDS = 10.0

PROOF_INSTRUCTIONS = "Reply with the single word: ok"
PROOF_INPUT_TEXT = "Say ok."

PERMANENT_RENEWAL_CODES = frozenset(
    {
        "refresh_token_expired",
        "refresh_token_reused",
        "refresh_token_invalidated",
    }
)

VERDICT_BY_UPSTREAM_CODE: dict[str, ProofVerdict] = {
    "usage_limit_reached": ProofVerdict.LINKED,
    "usage_not_included": ProofVerdict.TERMINAL_INELIGIBLE,
    "insufficient_quota": ProofVerdict.TERMINAL_INELIGIBLE,
    "cyber_policy": ProofVerdict.POLICY_REJECTED,
    "invalid_prompt": ProofVerdict.POLICY_REJECTED,
    "bio_policy": ProofVerdict.POLICY_REJECTED,
    "context_length_exceeded": ProofVerdict.INVALID_REQUEST,
    "invalid_image": ProofVerdict.INVALID_REQUEST,
    "rate_limit_exceeded": ProofVerdict.TRANSIENT,
    "server_is_overloaded": ProofVerdict.TRANSIENT,
    "slow_down": ProofVerdict.TRANSIENT,
}
