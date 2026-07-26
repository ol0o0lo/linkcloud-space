from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("subscriptions", "0001_initial"),
        ("wallet", "0002_alter_withdrawalrequest_pay_channel"),
    ]

    operations = [
        migrations.CreateModel(
            name="PaymentTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("biz_type", models.CharField(max_length=64)),
                ("biz_id", models.CharField(max_length=64)),
                ("transaction_no", models.CharField(max_length=64, unique=True)),
                ("provider", models.CharField(choices=[("wechat", "微信支付")], default="wechat", max_length=16)),
                ("payment_mode", models.CharField(choices=[("native", "微信扫码支付"), ("miniprogram", "微信小程序支付")], max_length=16)),
                ("amount", models.PositiveIntegerField(help_text="金额，单位：分")),
                ("description", models.CharField(max_length=128)),
                ("expires_at", models.DateTimeField()),
                ("provider_trade_no", models.CharField(blank=True, default=None, max_length=128, null=True, unique=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "待支付"), ("succeeded", "支付成功"), ("failed", "支付失败"), ("exception", "异常待处理")], default="pending", max_length=16
                    ),
                ),
                ("callback_event_id", models.CharField(blank=True, default=None, max_length=128, null=True, unique=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("request_snapshot", models.JSONField(blank=True, default=dict)),
                ("response_snapshot", models.JSONField(blank=True, default=dict)),
            ],
            options={"db_table": "payments_payment_transaction"},
        ),
        migrations.CreateModel(
            name="PayoutTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("biz_type", models.CharField(max_length=64)),
                ("biz_id", models.CharField(max_length=64)),
                ("provider", models.CharField(choices=[("wechat", "微信支付")], default="wechat", max_length=16)),
                ("out_trade_no", models.CharField(max_length=64, unique=True)),
                ("provider_trade_no", models.CharField(blank=True, default="", max_length=128)),
                ("idempotency_key", models.CharField(max_length=120, unique=True)),
                ("amount", models.PositiveIntegerField(help_text="金额，单位：分")),
                ("payee_snapshot", models.JSONField(default=dict)),
                ("request_snapshot", models.JSONField(blank=True, default=dict)),
                ("response_snapshot", models.JSONField(blank=True, default=dict)),
                (
                    "status",
                    models.CharField(choices=[("pending", "待发起"), ("processing", "处理中"), ("succeeded", "成功"), ("failed", "失败")], default="pending", max_length=16),
                ),
                ("error_code", models.CharField(blank=True, default="", max_length=64)),
                ("error_message", models.CharField(blank=True, default="", max_length=255)),
                ("executed_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={"db_table": "payments_payout_transaction", "ordering": ("-created_at", "-pk")},
        ),
        migrations.AddConstraint(
            model_name="paymenttransaction",
            constraint=models.UniqueConstraint(fields=("biz_type", "biz_id"), name="payments_transaction_business_unique"),
        ),
        migrations.AddIndex(
            model_name="paymenttransaction",
            index=models.Index(fields=["biz_type", "biz_id"], name="payments_tx_business_idx"),
        ),
        migrations.AddIndex(
            model_name="payouttransaction",
            index=models.Index(fields=["biz_type", "biz_id", "status"], name="payments_payout_biz_idx"),
        ),
    ]
