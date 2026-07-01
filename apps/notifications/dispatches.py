from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.notifications.constants import NotificationDispatchScope, NotificationDispatchStatus
from apps.notifications.models import NotificationDispatch
from apps.notifications.services import notify
from apps.organizations.models import Organization, OrganizationMember


def resolve_dispatch_recipients(dispatch: NotificationDispatch) -> list[User]:
    """Resolve active users targeted by a management dispatch."""
    recipients = User.objects.filter(is_active=True)

    if dispatch.owner_organization_id and dispatch.scope == NotificationDispatchScope.ORGANIZATION:
        recipients = recipients.filter(organizationmember__organization_id=dispatch.owner_organization_id)
    elif dispatch.scope == NotificationDispatchScope.ORGANIZATION:
        recipients = recipients.filter(organizationmember__organization_id__in=dispatch.scope_ids)
    elif dispatch.scope == NotificationDispatchScope.USERS:
        recipients = recipients.filter(pk__in=dispatch.scope_ids)

    if dispatch.owner_organization_id:
        recipients = recipients.filter(organizationmember__organization_id=dispatch.owner_organization_id)

    return list(recipients.distinct().order_by("pk"))


def _notification_organization(dispatch: NotificationDispatch) -> Organization | None:
    """
    Return the org safe to pass into notify(), or None when recipients may span orgs.

    notify() validates every recipient belongs to the provided organization, so
    platform-owned fanouts must not pretend to belong to a single tenant.
    """
    if dispatch.owner_organization_id:
        return dispatch.owner_organization
    if dispatch.scope == NotificationDispatchScope.ORGANIZATION and len(dispatch.scope_ids) == 1:
        return Organization.objects.filter(pk=dispatch.scope_ids[0]).first()
    return None


def execute_dispatch(dispatch_id: int) -> int:
    """
    Execute a notification dispatch and return the number of delivered rows.

    The row lock keeps concurrent workers from creating duplicate notifications:
    the second worker waits, then observes the sent status and returns the
    already-recorded delivery count.
    """
    with transaction.atomic():
        dispatch = NotificationDispatch.objects.select_for_update().get(pk=dispatch_id)
        if dispatch.status == NotificationDispatchStatus.SENT:
            return dispatch.delivered_count

        dispatch.status = NotificationDispatchStatus.SENDING
        dispatch.error_message = ""
        dispatch.sent_at = None
        dispatch.save(update_fields=["status", "error_message", "sent_at", "updated_at"])

        target_count = 0
        delivered_count = 0

        if dispatch.owner_organization_id is None and dispatch.scope == NotificationDispatchScope.ORGANIZATION:
            for organization_id in dict.fromkeys(dispatch.scope_ids):
                organization = Organization.objects.get(pk=organization_id)
                recipients = list(
                    User.objects.filter(
                        is_active=True,
                        pk__in=OrganizationMember.objects.filter(organization_id=organization_id).values("user_id"),
                    ).order_by("pk")
                )
                target_count += len(recipients)
                delivered_count += len(
                    notify(
                        recipients,
                        title=dispatch.title,
                        url=dispatch.url,
                        organization=organization,
                        body=dispatch.body,
                        category=dispatch.category,
                        data=dispatch.data,
                        dispatch=dispatch,
                    )
                )
        else:
            recipients = resolve_dispatch_recipients(dispatch)
            notifications = notify(
                recipients,
                title=dispatch.title,
                url=dispatch.url,
                organization=_notification_organization(dispatch),
                body=dispatch.body,
                category=dispatch.category,
                data=dispatch.data,
                dispatch=dispatch,
            )
            target_count = len(recipients)
            delivered_count = len(notifications)

        dispatch.target_count = target_count
        dispatch.delivered_count = delivered_count
        dispatch.status = NotificationDispatchStatus.SENT
        dispatch.sent_at = timezone.now()
        dispatch.save(update_fields=["target_count", "delivered_count", "status", "sent_at", "updated_at"])
        return dispatch.delivered_count
