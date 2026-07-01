from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models

from apps.base.mixins import BaseModelMixin, CreateUpdateTimeModelMixin
from apps.notifications.constants import NotificationDispatchScope, NotificationDispatchStatus
from apps.notifications.managers import NotificationQuerySet


class NotificationDispatch(BaseModelMixin):
    Scope = NotificationDispatchScope
    Status = NotificationDispatchStatus

    owner_organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notification_dispatches",
        null=True,
        blank=True,
        help_text="Management owner; null means platform-owned.",
    )
    scope = models.CharField(max_length=32, choices=NotificationDispatchScope.choices)
    scope_ids = models.JSONField(default=list, blank=True)
    category = models.CharField(max_length=64, blank=True)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    url = models.CharField(max_length=500, null=True, blank=True)
    data = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=NotificationDispatchStatus.choices, default=NotificationDispatchStatus.PENDING)
    target_count = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["owner_organization", "-created_at"], name="notif_dispatch_owner_idx"),
            models.Index(fields=["scope", "-created_at"], name="notif_dispatch_scope_idx"),
            models.Index(fields=["status", "-created_at"], name="notif_dispatch_status_idx"),
        ]

    def clean(self):
        super().clean()
        if not isinstance(self.scope_ids, list):
            raise ValidationError({"scope_ids": "Scope ids must be a list of integers."})
        if any(type(scope_id) is not int for scope_id in self.scope_ids):
            raise ValidationError({"scope_ids": "Scope ids must be a list of integers."})
        if self.scope == self.Scope.PLATFORM and self.scope_ids:
            raise ValidationError({"scope_ids": "Platform dispatches must not include scope_ids."})
        if self.scope != self.Scope.PLATFORM and not self.scope_ids:
            raise ValidationError({"scope_ids": "Organization and users dispatches require scope_ids."})

    def __str__(self):
        """Return a readable label for the dispatch."""
        return f"{self.get_scope_display()} notification dispatch: {self.title}"


class Notification(CreateUpdateTimeModelMixin):
    """
    Generic in-app notification.

    `target` is a GenericForeignKey, so deletes of the target object do NOT
    cascade at the database level. Cleanup is performed by a per-model
    `post_delete` receiver wired up from `settings.NOTIFICATIONS_TARGET_MODELS`.
    Raw SQL deletes or `_raw_delete()` on target rows will leave orphan
    notifications — register the model in that setting and use ORM deletes.

    `category` is a producer-defined key registered via
    `apps.notifications.categories.register`. It drives per-user preferences and
    UI grouping. Empty `category` always sends (back-compat for ad-hoc events).
    """

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        help_text="The user who will see this notification in their inbox.",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
        help_text="Org scope; null for personal/global notifications.",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="The user whose action produced this notification (null for system events).",
    )

    target_content_type = models.ForeignKey(
        ContentType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    target_object_id = models.PositiveBigIntegerField(null=True, blank=True)
    target = GenericForeignKey("target_content_type", "target_object_id")

    category = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        help_text="Producer-defined category key — see apps/notifications/categories.py.",
    )
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    url = models.CharField(max_length=500, null=True, blank=True)
    data = models.JSONField(default=dict, blank=True)
    dispatch = models.ForeignKey(
        NotificationDispatch,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
        help_text="The management dispatch that produced this inbox row.",
    )
    read_at = models.DateTimeField(null=True, blank=True, db_index=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Per-row retention override; cleanup deletes the row once this time has passed.",
    )

    objects = NotificationQuerySet.as_manager()

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["recipient", "organization", "-created_at"], name="notificatio_recipie_6e705f_idx"),
            models.Index(fields=["recipient", "organization", "read_at"], name="notificatio_recipie_40360d_idx"),
            models.Index(fields=["recipient", "category", "-created_at"], name="notificatio_recipie_61125d_idx"),
            models.Index(fields=["target_content_type", "target_object_id"], name="notificatio_target__dfbaf5_idx"),
        ]

    def __str__(self):
        """Return a string representation of the notification."""
        return f"Notification for {self.recipient}: {self.title}"

    @property
    def is_read(self):
        return self.read_at is not None


class NotificationPreference(CreateUpdateTimeModelMixin):
    """
    Per-user, per-category channel preferences.

    Rows are created on-demand when a user changes a preference. The absence of
    a row means "use the default_channels for this category" (see
    `apps.notifications.categories`).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    category = models.CharField(max_length=64)
    in_app = models.BooleanField(default=True)
    email = models.BooleanField(default=False)

    class Meta:
        unique_together = ("user", "category")

    def __str__(self):
        """Return a string representation of the preference."""
        return f"{self.user} / {self.category}: in_app={self.in_app}, email={self.email}"
