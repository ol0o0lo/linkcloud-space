from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models

from apps.base.mixins import BaseModelMixin, CreateUpdateTimeModelMixin
from apps.notifications.constants import NotificationDispatchScope, NotificationDispatchStatus
from apps.notifications.managers import NotificationQuerySet


class NotificationDispatch(BaseModelMixin):
    owner_organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notification_dispatches",
        null=True,
        blank=True,
        help_text="Management owner; null means platform-owned.",
        verbose_name="所属组织",
    )
    scope = models.CharField(max_length=32, choices=NotificationDispatchScope.choices, verbose_name="作用域")
    scope_ids = models.JSONField(default=list, blank=True, verbose_name="作用域标识列表")
    category = models.CharField(max_length=64, blank=True, verbose_name="分类")
    title = models.CharField(max_length=255, verbose_name="标题")
    body = models.TextField(blank=True, verbose_name="正文")
    url = models.CharField(max_length=500, null=True, blank=True, verbose_name="链接地址")
    data = models.JSONField(default=dict, blank=True, verbose_name="扩展数据")
    status = models.CharField(max_length=20, choices=NotificationDispatchStatus.choices, default=NotificationDispatchStatus.PENDING, verbose_name="状态")
    target_count = models.PositiveIntegerField(default=0, verbose_name="目标数量")
    delivered_count = models.PositiveIntegerField(default=0, verbose_name="送达数量")
    error_message = models.TextField(blank=True, verbose_name="错误信息")
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name="发送时间")

    class Meta:
        verbose_name = "通知派发任务"
        verbose_name_plural = "通知派发任务"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["owner_organization", "-created_at"], name="notif_dispatch_owner_idx"),
            models.Index(fields=["scope", "-created_at"], name="notif_dispatch_scope_idx"),
            models.Index(fields=["status", "-created_at"], name="notif_dispatch_status_idx"),
        ]

    def clean(self):
        super().clean()
        if not isinstance(self.scope_ids, list):
            raise ValidationError({"scope_ids": "scope_ids 必须是整数列表。"})
        if any(type(scope_id) is not int for scope_id in self.scope_ids):
            raise ValidationError({"scope_ids": "scope_ids 必须是整数列表。"})
        if self.scope == NotificationDispatchScope.PLATFORM and self.scope_ids:
            raise ValidationError({"scope_ids": "平台级通知分发不能包含 scope_ids。"})
        if self.scope != NotificationDispatchScope.PLATFORM and not self.scope_ids:
            raise ValidationError({"scope_ids": "组织、团队和用户级通知分发必须提供 scope_ids。"})
        if self.scope == NotificationDispatchScope.TEAMS:
            if self.owner_organization_id is None:
                raise ValidationError({"owner_organization": "团队级通知分发必须归属于组织。"})

            from apps.teams.models import Team

            target_ids = set(self.scope_ids)
            team_ids = set(
                Team.objects.filter(
                    organization_id=self.owner_organization_id,
                    pk__in=target_ids,
                ).values_list("pk", flat=True)
            )
            if team_ids != target_ids:
                raise ValidationError({"scope_ids": "团队级通知分发只能选择所属组织内的团队。"})
        if self.url:
            normalized_url = self.url.lower()
            is_internal_path = self.url.startswith("/") and not self.url.startswith(("//", "/\\"))
            is_http_url = normalized_url.startswith(("http://", "https://"))
            if not is_internal_path and not is_http_url:
                raise ValidationError({"url": "URL 必须是站内路径或使用 http/https 协议。"})

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
        verbose_name="接收人",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
        help_text="Org scope; null for personal/global notifications.",
        verbose_name="所属组织",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="The user whose action produced this notification (null for system events).",
        verbose_name="操作人",
    )

    target_content_type = models.ForeignKey(
        ContentType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        verbose_name="目标内容类型",
    )
    target_object_id = models.PositiveBigIntegerField(null=True, blank=True, verbose_name="目标对象标识")
    target = GenericForeignKey("target_content_type", "target_object_id")

    category = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        help_text="Producer-defined category key — see apps/notifications/categories.py.",
        verbose_name="分类",
    )
    title = models.CharField(max_length=255, verbose_name="标题")
    body = models.TextField(blank=True, verbose_name="正文")
    url = models.CharField(max_length=500, null=True, blank=True, verbose_name="链接地址")
    data = models.JSONField(default=dict, blank=True, verbose_name="扩展数据")
    dispatch = models.ForeignKey(
        NotificationDispatch,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
        help_text="The management dispatch that produced this inbox row.",
        verbose_name="通知任务",
    )
    read_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="阅读时间")
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Per-row retention override; cleanup deletes the row once this time has passed.",
        verbose_name="过期时间",
    )

    objects = NotificationQuerySet.as_manager()

    class Meta:
        verbose_name = "通知"
        verbose_name_plural = "通知"
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
        verbose_name="用户",
    )
    category = models.CharField(max_length=64, verbose_name="分类")
    in_app = models.BooleanField(default=True, verbose_name="站内通知")
    email = models.BooleanField(default=False, verbose_name="邮箱")

    class Meta:
        verbose_name = "通知偏好"
        verbose_name_plural = "通知偏好"
        constraints = [models.UniqueConstraint(fields=("user", "category"), name="notifications_user_cat_unique")]

    def __str__(self):
        """Return a string representation of the preference."""
        return f"{self.user} / {self.category}: in_app={self.in_app}, email={self.email}"
