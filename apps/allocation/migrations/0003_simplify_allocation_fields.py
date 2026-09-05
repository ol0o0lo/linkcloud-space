from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("allocation", "0001_initial"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="allocationrequest",
            name="allocation_request_distribution_shape",
        ),
        migrations.RemoveConstraint(
            model_name="allocationrequest",
            name="allocation_request_status_audit_shape",
        ),
        migrations.RemoveConstraint(
            model_name="allocationshare",
            name="allocation_share_credit_nonnegative",
        ),
        migrations.RemoveField(
            model_name="allocationrequest",
            name="fixed_distributable_amount",
        ),
        migrations.RenameField(
            model_name="allocationrequest",
            old_name="review_reason",
            new_name="rejection_reason",
        ),
        migrations.RenameField(
            model_name="allocationshare",
            old_name="credited_basis_amount",
            new_name="attributed_basis_amount",
        ),
        migrations.AddConstraint(
            model_name="allocationrequest",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(
                        ("distribution_method", "percentage"),
                        ("distribution_rate_bp__gte", 0),
                        ("distribution_rate_bp__isnull", False),
                        ("distribution_rate_bp__lte", 10000),
                    ),
                    models.Q(
                        ("distribution_method", "fixed"),
                        ("distribution_rate_bp__isnull", True),
                    ),
                    _connector="OR",
                ),
                name="allocation_request_distribution_shape",
            ),
        ),
        migrations.AddConstraint(
            model_name="allocationrequest",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(
                        ("rejection_reason", ""),
                        ("reviewed_at__isnull", True),
                        ("reviewed_by__isnull", True),
                        ("reviewed_by_name_snapshot", ""),
                        ("status", "pending"),
                        ("void_reason", ""),
                        ("voided_at__isnull", True),
                        ("voided_by__isnull", True),
                        ("voided_by_name_snapshot", ""),
                    ),
                    models.Q(
                        ("rejection_reason", ""),
                        ("reviewed_at__isnull", False),
                        ("reviewed_by__isnull", False),
                        ("status", "approved"),
                        ("void_reason", ""),
                        ("voided_at__isnull", True),
                        ("voided_by__isnull", True),
                        ("voided_by_name_snapshot", ""),
                        models.Q(("reviewed_by_name_snapshot", ""), _negated=True),
                    ),
                    models.Q(
                        ("reviewed_at__isnull", False),
                        ("reviewed_by__isnull", False),
                        ("status", "rejected"),
                        ("void_reason", ""),
                        ("voided_at__isnull", True),
                        ("voided_by__isnull", True),
                        ("voided_by_name_snapshot", ""),
                        models.Q(("rejection_reason", ""), _negated=True),
                        models.Q(("reviewed_by_name_snapshot", ""), _negated=True),
                    ),
                    models.Q(
                        ("rejection_reason", ""),
                        ("reviewed_at__isnull", True),
                        ("reviewed_by__isnull", True),
                        ("reviewed_by_name_snapshot", ""),
                        ("status", "expired"),
                        ("void_reason", ""),
                        ("voided_at__isnull", True),
                        ("voided_by__isnull", True),
                        ("voided_by_name_snapshot", ""),
                    ),
                    models.Q(
                        ("rejection_reason", ""),
                        ("reviewed_at__isnull", False),
                        ("reviewed_by__isnull", False),
                        ("status", "voided"),
                        ("voided_at__isnull", False),
                        ("voided_by__isnull", False),
                        models.Q(("reviewed_by_name_snapshot", ""), _negated=True),
                        models.Q(("voided_by_name_snapshot", ""), _negated=True),
                        models.Q(("void_reason", ""), _negated=True),
                    ),
                    _connector="OR",
                ),
                name="allocation_request_status_audit_shape",
            ),
        ),
        migrations.AddConstraint(
            model_name="allocationshare",
            constraint=models.CheckConstraint(
                condition=models.Q(("attributed_basis_amount__gte", 0)),
                name="allocation_share_attributed_nonnegative",
            ),
        ),
    ]
