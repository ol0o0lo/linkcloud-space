from apps.base.enums import StrChoices


class NotificationChannel(StrChoices):
    """
    Delivery channels recognized by `notify()`, `send_email()`, and the prefs API.

    Use these constants when declaring `default_channels` in
    `settings.NOTIFICATIONS_CATEGORIES` so the valid set is discoverable and
    typos are caught at import time:

        from apps.notifications.constants import NotificationChannel

        NOTIFICATIONS_CATEGORIES = [
            {
                "key": "comments",
                "label": "Comments",
                "default_channels": (NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            },
        ]
    """

    IN_APP = "in_app", "In-app"
    EMAIL = "email", "Email"


class NotificationDispatchScope(StrChoices):
    PLATFORM = "platform", "Platform"
    ORGANIZATION = "organization", "Organization"
    TEAMS = "teams", "Teams"
    USERS = "users", "Users"


class NotificationDispatchStatus(StrChoices):
    PENDING = "pending", "Pending"
    SENDING = "sending", "Sending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"
