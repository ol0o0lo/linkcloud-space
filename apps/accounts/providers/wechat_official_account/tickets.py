from apps.accounts.providers.wechat_pc_login.tickets import (
    POLL_INTERVAL_SECONDS,
    TICKET_TTL_SECONDS,
    CreatedLoginTicket,
    LoginTicketConflict,
    LoginTicketError,
    LoginTicketExpired,
    LoginTicketForbidden,
    begin_login_completion,
    confirm_login_identity,
    delete_login_ticket,
    finish_login_completion,
    get_login_status,
    get_or_create_browser_id,
)

__all__ = [
    "POLL_INTERVAL_SECONDS",
    "TICKET_TTL_SECONDS",
    "CreatedLoginTicket",
    "LoginTicketConflict",
    "LoginTicketError",
    "LoginTicketExpired",
    "LoginTicketForbidden",
    "begin_login_completion",
    "create_login_ticket",
    "delete_login_ticket",
    "finish_login_completion",
    "get_login_status",
    "get_or_create_browser_id",
    "mark_login_scanned",
]

PROVIDER_ID = "wechat_official_account"


def create_login_ticket(request, redirect_path: str) -> CreatedLoginTicket:
    from apps.accounts.providers.wechat_pc_login.tickets import create_login_ticket as create_pc_login_ticket

    return create_pc_login_ticket(request, redirect_path, provider=PROVIDER_ID)


def mark_login_scanned(scene: str, openid: str) -> bool:
    try:
        confirm_login_identity(scene, provider=PROVIDER_ID, identity_data={"openid": openid})
    except LoginTicketError:
        return False
    return True
