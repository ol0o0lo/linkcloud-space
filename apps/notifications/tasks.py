from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from celery import shared_task

from apps.notifications.dispatches import execute_dispatch
from apps.notifications.models import Notification, NotificationDispatch


def purge_expired(days: int | None = None) -> int:
    """
    Delete notifications that are past their retention window.

    A row is deleted when:
      - `expires_at` is set and has passed, OR
      - `expires_at` is null and `created_at` is older than `days`
        (defaulting to settings.NOTIFICATIONS_RETENTION_DAYS).

    Returns the number of rows deleted.
    """
    retention_days = days if days is not None else settings.NOTIFICATIONS_RETENTION_DAYS
    now = timezone.now()
    cutoff = now - timedelta(days=retention_days)
    qs = Notification.objects.filter(Q(expires_at__lte=now) | Q(expires_at__isnull=True, created_at__lt=cutoff))
    deleted, _ = qs.delete()
    return deleted


@shared_task
def purge_expired_notifications() -> int:
    """Celery entry point. Runs daily via CELERY_BEAT_SCHEDULE."""
    return purge_expired()


@shared_task
def dispatch_notification(dispatch_id: int) -> int:
    """Celery entry point for executing a management notification dispatch."""
    try:
        return execute_dispatch(dispatch_id)
    except Exception as exc:
        NotificationDispatch.objects.filter(pk=dispatch_id).exclude(status=NotificationDispatch.Status.SENT).update(
            status=NotificationDispatch.Status.FAILED,
            error_message=str(exc)[:2000],
        )
        raise
