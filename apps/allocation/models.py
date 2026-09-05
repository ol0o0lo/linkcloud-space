from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

from apps.allocation.constants import (
    ALLOCATION_CURRENCY,
    ALLOCATION_REVIEW_VALIDITY_HOURS,
    AccrualEntryType,
    AllocationDistributionMethod,
    AllocationItemEffect,
    AllocationRequestStatus,
    AllocationRuleSource,
)
from apps.base.mixins import CreateUpdateTimeModelMixin

REQUEST_STATUS_TRANSITIONS = {
    AllocationRequestStatus.PENDING: {
        AllocationRequestStatus.PENDING,
        AllocationRequestStatus.APPROVED,
        AllocationRequestStatus.REJECTED,
        AllocationRequestStatus.EXPIRED,
    },
    AllocationRequestStatus.APPROVED: {
        AllocationRequestStatus.APPROVED,
        AllocationRequestStatus.VOIDED,
    },
    AllocationRequestStatus.REJECTED: {AllocationRequestStatus.REJECTED},
    AllocationRequestStatus.EXPIRED: {AllocationRequestStatus.EXPIRED},
    AllocationRequestStatus.VOIDED: {AllocationRequestStatus.VOIDED},
}


class ImmutableQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValidationError("已提交的分配明细和应计流水不可批量修改。")

    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError("已提交的分配明细和应计流水不可批量修改。")

    def delete(self):
        raise ValidationError("已提交的分配明细和应计流水不可批量删除。")


class AllocationRequest(CreateUpdateTimeModelMixin):
    objects = ImmutableQuerySet.as_manager()

    IMMUTABLE_FIELDS = (
        "organization_id",
        "team_id",
        "team_name_snapshot",
        "rule_source",
        "basis_amount",
        "distribution_method",
        "distribution_rate_bp",
        "distributable_amount",
        "currency",
        "source_snapshot",
        "submitted_by_id",
        "submitted_by_name_snapshot",
        "submitted_at",
        "expires_at",
    )
    REVIEW_AUDIT_FIELDS = ("reviewed_by_id", "reviewed_by_name_snapshot", "reviewed_at", "rejection_reason")
    VOID_AUDIT_FIELDS = ("voided_by_id", "voided_by_name_snapshot", "voided_at", "void_reason")

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="allocation_requests", verbose_name="所属组织")
    team = models.ForeignKey(
        "teams.Team",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="allocation_requests",
        verbose_name="归属团队",
    )
    team_name_snapshot = models.CharField(max_length=100, blank=True, default="", verbose_name="归属团队名称快照")
    rule_source = models.CharField(max_length=20, choices=AllocationRuleSource.choices, default=AllocationRuleSource.DEFAULT, verbose_name="规则来源")
    status = models.CharField(max_length=20, choices=AllocationRequestStatus.choices, default=AllocationRequestStatus.PENDING, db_index=True, verbose_name="申请状态")
    basis_amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)], verbose_name="计算基数")
    distribution_method = models.CharField(max_length=20, choices=AllocationDistributionMethod.choices, verbose_name="分配方式")
    distribution_rate_bp = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MaxValueValidator(10000)], verbose_name="分配比例（万分比）")
    distributable_amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)], verbose_name="可分配金额")
    currency = models.CharField(max_length=3, default=ALLOCATION_CURRENCY, verbose_name="币种")
    source_snapshot = models.JSONField(default=dict, blank=True, verbose_name="业务来源快照")

    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="submitted_allocation_requests", verbose_name="申请人")
    submitted_by_name_snapshot = models.CharField(max_length=150, verbose_name="申请人姓名快照")
    submitted_at = models.DateTimeField(db_index=True, verbose_name="提交时间")
    expires_at = models.DateTimeField(db_index=True, verbose_name="审核截止时间")

    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="reviewed_allocation_requests", verbose_name="审核人")
    reviewed_by_name_snapshot = models.CharField(max_length=150, blank=True, default="", verbose_name="审核人姓名快照")
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="审核时间")
    rejection_reason = models.TextField(blank=True, default="", verbose_name="审核不通过原因")

    voided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="voided_allocation_requests", verbose_name="作废人")
    voided_by_name_snapshot = models.CharField(max_length=150, blank=True, default="", verbose_name="作废人姓名快照")
    voided_at = models.DateTimeField(null=True, blank=True, verbose_name="作废时间")
    void_reason = models.TextField(blank=True, default="", verbose_name="作废原因")

    class Meta:
        verbose_name = "分配申请"
        verbose_name_plural = "分配申请"
        ordering = ("-submitted_at", "-pk")
        indexes = [
            models.Index(fields=("organization", "status", "expires_at"), name="alloc_req_status_exp_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(basis_amount__gte=0), name="allocation_request_basis_nonnegative"),
            models.CheckConstraint(condition=Q(distributable_amount__gte=0), name="allocation_request_pool_nonnegative"),
            models.CheckConstraint(condition=Q(currency=ALLOCATION_CURRENCY), name="allocation_request_currency_cny"),
            models.CheckConstraint(condition=Q(expires_at__gt=F("submitted_at")), name="allocation_request_expiry_after_submit"),
            models.CheckConstraint(
                condition=(
                    Q(
                        distribution_method=AllocationDistributionMethod.PERCENTAGE,
                        distribution_rate_bp__isnull=False,
                        distribution_rate_bp__gte=0,
                        distribution_rate_bp__lte=10000,
                    )
                    | Q(
                        distribution_method=AllocationDistributionMethod.FIXED,
                        distribution_rate_bp__isnull=True,
                    )
                ),
                name="allocation_request_distribution_shape",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        status=AllocationRequestStatus.PENDING,
                        reviewed_by__isnull=True,
                        reviewed_at__isnull=True,
                        reviewed_by_name_snapshot="",
                        voided_by__isnull=True,
                        voided_at__isnull=True,
                        voided_by_name_snapshot="",
                        rejection_reason="",
                        void_reason="",
                    )
                    | (
                        Q(
                            status=AllocationRequestStatus.APPROVED,
                            reviewed_by__isnull=False,
                            reviewed_at__isnull=False,
                            voided_by__isnull=True,
                            voided_at__isnull=True,
                            voided_by_name_snapshot="",
                            rejection_reason="",
                            void_reason="",
                        )
                        & ~Q(reviewed_by_name_snapshot="")
                    )
                    | (
                        Q(
                            status=AllocationRequestStatus.REJECTED,
                            reviewed_by__isnull=False,
                            reviewed_at__isnull=False,
                            voided_by__isnull=True,
                            voided_at__isnull=True,
                            voided_by_name_snapshot="",
                            void_reason="",
                        )
                        & ~Q(rejection_reason="")
                        & ~Q(reviewed_by_name_snapshot="")
                    )
                    | Q(
                        status=AllocationRequestStatus.EXPIRED,
                        reviewed_by__isnull=True,
                        reviewed_at__isnull=True,
                        reviewed_by_name_snapshot="",
                        voided_by__isnull=True,
                        voided_at__isnull=True,
                        voided_by_name_snapshot="",
                        rejection_reason="",
                        void_reason="",
                    )
                    | (
                        Q(
                            status=AllocationRequestStatus.VOIDED,
                            reviewed_by__isnull=False,
                            reviewed_at__isnull=False,
                            voided_by__isnull=False,
                            voided_at__isnull=False,
                            rejection_reason="",
                        )
                        & ~Q(reviewed_by_name_snapshot="")
                        & ~Q(voided_by_name_snapshot="")
                        & ~Q(void_reason="")
                    )
                ),
                name="allocation_request_status_audit_shape",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}
        if not isinstance(self.source_snapshot, dict):
            errors["source_snapshot"] = "业务来源快照必须是对象。"
        if self.team_id and self.team.organization_id != self.organization_id:
            errors["team"] = "归属团队必须属于当前组织。"
        if self.team_id and not self.team_name_snapshot:
            errors["team_name_snapshot"] = "选择归属团队时必须保存团队名称快照。"
        if self.submitted_at and self.expires_at and self.expires_at != self.submitted_at + timedelta(hours=ALLOCATION_REVIEW_VALIDITY_HOURS):
            errors["expires_at"] = "审核截止时间必须是提交后 168 小时。"
        if self.pk:
            previous = type(self).objects.filter(pk=self.pk).values("status", *self.IMMUTABLE_FIELDS, *self.REVIEW_AUDIT_FIELDS, *self.VOID_AUDIT_FIELDS).first()
            if previous:
                changed = [field for field in self.IMMUTABLE_FIELDS if previous[field] != getattr(self, field)]
                if changed:
                    errors["__all__"] = f"分配申请提交后不可修改：{', '.join(changed)}。"
                if self.status not in REQUEST_STATUS_TRANSITIONS.get(previous["status"], {previous["status"]}):
                    errors["status"] = "分配申请状态不允许逆向流转或从终态重新打开。"
                review_changed = any(previous[field] != getattr(self, field) for field in self.REVIEW_AUDIT_FIELDS)
                if review_changed and previous["status"] != AllocationRequestStatus.PENDING:
                    errors["reviewed_at"] = "审核事实形成后不可修改。"
                void_changed = any(previous[field] != getattr(self, field) for field in self.VOID_AUDIT_FIELDS)
                if void_changed and previous["status"] != AllocationRequestStatus.APPROVED:
                    errors["voided_at"] = "作废事实形成后不可修改。"
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"AllocationRequest<{self.pk}:{self.status}>"


class AllocationItem(models.Model):
    objects = ImmutableQuerySet.as_manager()

    allocation_request = models.ForeignKey(AllocationRequest, on_delete=models.PROTECT, related_name="items", verbose_name="所属分配申请")
    name = models.CharField(max_length=100, verbose_name="项目名称")
    effect = models.CharField(max_length=20, choices=AllocationItemEffect.choices, verbose_name="增减方向")
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0.01)], verbose_name="金额")
    sort_order = models.PositiveSmallIntegerField(default=0, verbose_name="排序")
    remark = models.CharField(max_length=255, blank=True, default="", verbose_name="备注")

    class Meta:
        verbose_name = "分配计算项"
        verbose_name_plural = "分配计算项"
        ordering = ("sort_order", "pk")
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="allocation_item_amount_positive"),
        ]

    def __str__(self):
        return f"{self.name}: {self.effect} {self.amount}"

    def save(self, *args, **kwargs):
        if self.pk and not self._state.adding:
            raise ValidationError("分配申请提交后，计算依据明细不可修改。")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("分配申请提交后，计算依据明细不可删除。")


class AllocationShare(models.Model):
    objects = ImmutableQuerySet.as_manager()

    allocation_request = models.ForeignKey(AllocationRequest, on_delete=models.PROTECT, related_name="shares", verbose_name="所属分配申请")
    beneficiary_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="allocation_shares", verbose_name="受益人")
    beneficiary_name_snapshot = models.CharField(max_length=150, verbose_name="受益人姓名快照")
    weight_bp = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10000)], verbose_name="分配权重（万分比）")
    attributed_basis_amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)], verbose_name="归属计算基数")
    allocated_amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)], verbose_name="分配金额")
    sort_order = models.PositiveSmallIntegerField(default=0, verbose_name="排序")
    remark = models.CharField(max_length=255, blank=True, default="", verbose_name="备注")

    class Meta:
        verbose_name = "受益人分配份额"
        verbose_name_plural = "受益人分配份额"
        ordering = ("sort_order", "pk")
        constraints = [
            models.UniqueConstraint(fields=("allocation_request", "beneficiary_user"), name="allocation_request_beneficiary_unique"),
            models.CheckConstraint(condition=Q(weight_bp__gte=1, weight_bp__lte=10000), name="allocation_share_weight_range"),
            models.CheckConstraint(condition=Q(attributed_basis_amount__gte=0), name="allocation_share_attributed_nonnegative"),
            models.CheckConstraint(condition=Q(allocated_amount__gte=0), name="allocation_share_amount_nonnegative"),
        ]

    def __str__(self):
        return f"AllocationShare<{self.allocation_request_id}:{self.beneficiary_user_id}>"

    def save(self, *args, **kwargs):
        if self.pk and not self._state.adding:
            raise ValidationError("分配申请提交后，受益人分配明细不可修改。")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("分配申请提交后，受益人分配明细不可删除。")


class AccrualEntry(models.Model):
    objects = ImmutableQuerySet.as_manager()

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="accrual_entries", verbose_name="所属组织")
    beneficiary_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="accrual_entries", verbose_name="受益人")
    beneficiary_name_snapshot = models.CharField(max_length=150, verbose_name="受益人姓名快照")
    entry_type = models.CharField(max_length=20, choices=AccrualEntryType.choices, db_index=True, verbose_name="流水类型")
    amount = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="应计金额")
    currency = models.CharField(max_length=3, default=ALLOCATION_CURRENCY, verbose_name="币种")
    effective_at = models.DateTimeField(db_index=True, verbose_name="生效时间")
    effective_month = models.DateField(db_index=True, verbose_name="归属月份")
    allocation_share = models.OneToOneField(AllocationShare, null=True, blank=True, on_delete=models.PROTECT, related_name="accrual_entry", verbose_name="来源分配份额")
    reversal_of = models.OneToOneField("self", null=True, blank=True, on_delete=models.PROTECT, related_name="reversal", verbose_name="被冲销流水")
    reason = models.TextField(blank=True, default="", verbose_name="原因")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_accrual_entries", verbose_name="创建人")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "应计收益流水"
        verbose_name_plural = "应计收益流水"
        ordering = ("-effective_at", "-pk")
        indexes = [
            models.Index(fields=("organization", "beneficiary_user", "effective_month"), name="accrual_org_user_month_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=~Q(amount=0), name="accrual_entry_amount_nonzero"),
            models.CheckConstraint(condition=Q(currency=ALLOCATION_CURRENCY), name="accrual_entry_currency_cny"),
            models.CheckConstraint(
                condition=(
                    Q(entry_type=AccrualEntryType.ALLOCATION, allocation_share__isnull=False, reversal_of__isnull=True, amount__gt=0)
                    | (Q(entry_type=AccrualEntryType.MANUAL_INCREASE, allocation_share__isnull=True, reversal_of__isnull=True, amount__gt=0) & ~Q(reason=""))
                    | (Q(entry_type=AccrualEntryType.MANUAL_DECREASE, allocation_share__isnull=True, reversal_of__isnull=True, amount__lt=0) & ~Q(reason=""))
                    | (Q(entry_type=AccrualEntryType.REVERSAL, allocation_share__isnull=True, reversal_of__isnull=False, amount__lt=0) & ~Q(reason=""))
                ),
                name="accrual_entry_source_sign_shape",
            ),
        ]

    def clean(self):
        super().clean()
        if self.effective_month and self.effective_month.day != 1:
            raise ValidationError({"effective_month": "生效月份必须保存为当月第一天。"})
        if self.reversal_of_id:
            if self.pk and self.reversal_of_id == self.pk:
                raise ValidationError({"reversal_of": "流水不能冲销自身。"})
            original = self.reversal_of
            errors = {}
            if original.entry_type != AccrualEntryType.ALLOCATION:
                errors["reversal_of"] = "当前只允许冲销业务分配流水。"
            if original.organization_id != self.organization_id:
                errors["organization"] = "冲销流水必须与原流水属于同一组织。"
            if original.beneficiary_user_id != self.beneficiary_user_id:
                errors["beneficiary_user"] = "冲销流水必须与原流水属于同一受益人。"
            if original.currency != self.currency:
                errors["currency"] = "冲销流水必须与原流水使用同一币种。"
            if self.amount != -original.amount:
                errors["amount"] = "冲销金额必须等于原流水金额的相反数。"
            if errors:
                raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.pk and not self._state.adding:
            raise ValidationError("应计流水不可修改；需要修正时请追加新的正负流水。")
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("应计流水不可删除。")

    def __str__(self):
        return f"AccrualEntry<{self.pk}:{self.entry_type}:{self.amount}>"
