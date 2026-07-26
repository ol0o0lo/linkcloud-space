from django.db import migrations


def migrate_legacy_transactions(apps, schema_editor):
    PaymentTransaction = apps.get_model("payments", "PaymentTransaction")
    PayoutTransaction = apps.get_model("payments", "PayoutTransaction")
    LegacyPaymentTransaction = apps.get_model("subscriptions", "PaymentTransaction")
    LegacyWithdrawalPayout = apps.get_model("wallet", "WithdrawalPayout")

    for payment in LegacyPaymentTransaction.objects.select_related("order"):
        order = payment.order
        PaymentTransaction.objects.get_or_create(
            transaction_no=payment.transaction_no,
            defaults={
                "biz_type": "subscriptions.saas_order",
                "biz_id": str(order.pk),
                "provider": payment.provider,
                "payment_mode": payment.payment_mode,
                "amount": order.payable_amount,
                "description": f"链云空间 {order.plan_snapshot.get('name', 'SaaS 服务')}",
                "expires_at": order.expires_at,
                "provider_trade_no": payment.provider_trade_no,
                "status": payment.status,
                "callback_event_id": payment.callback_event_id,
                "paid_at": payment.paid_at,
                "request_snapshot": payment.request_snapshot,
                "response_snapshot": payment.response_snapshot,
                "created_at": payment.created_at,
                "updated_at": payment.updated_at,
            },
        )

    for payout in LegacyWithdrawalPayout.objects.select_related("withdrawal_request"):
        withdrawal = payout.withdrawal_request
        PayoutTransaction.objects.get_or_create(
            idempotency_key=payout.idempotency_key,
            defaults={
                "biz_type": "wallet.withdrawal",
                "biz_id": str(withdrawal.pk),
                "provider": payout.provider,
                "out_trade_no": payout.out_trade_no,
                "provider_trade_no": payout.provider_trade_no,
                "amount": withdrawal.net_amount,
                "payee_snapshot": withdrawal.payee_account_snapshot,
                "request_snapshot": payout.request_payload,
                "response_snapshot": payout.response_payload,
                "status": payout.status,
                "error_code": payout.error_code,
                "error_message": payout.error_message,
                "executed_at": payout.executed_at,
                "created_at": payout.created_at,
                "updated_at": payout.updated_at,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(migrate_legacy_transactions, migrations.RunPython.noop),
    ]
