import logging

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from celery import shared_task

from apps.allocation.models import AllocationRequest
from apps.notifications.services import notify
from apps.organizations.models import OrganizationMember

logger = logging.getLogger(__name__)


@shared_task(autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 5})
def send_allocation_notification_task(
    *,
    allocation_request_id: int,
    recipient_user_ids: list[int],
    title: str,
    body: str,
    url: str,
    actor_id: int | None = None,
) -> int:
    allocation_request = get_object_or_404(AllocationRequest.objects.select_related("organization"), pk=allocation_request_id)
    organization = allocation_request.organization
    member_ids = set(OrganizationMember.objects.filter(organization=organization, user_id__in=recipient_user_ids).values_list("user_id", flat=True))
    recipients = list(get_user_model().objects.filter(pk__in=member_ids, is_active=True))
    actor = get_user_model().objects.filter(pk=actor_id).first() if actor_id else None
    notifications = notify(
        recipients,
        title=title,
        body=body,
        url=url,
        organization=organization,
        actor=actor,
        target=allocation_request,
        category="allocation.status",
        data={"allocation_request_id": allocation_request.pk},
    )
    return len(notifications)


def enqueue_allocation_notification(**kwargs) -> None:
    try:
        send_allocation_notification_task.delay(**kwargs)
    except Exception:
        logger.exception("分配申请通知入队失败", extra={"allocation_request_id": kwargs.get("allocation_request_id")})
