from django.contrib import admin

from apps.payments.models import PaymentTransaction, PayoutTransaction


class NoPhysicalDeleteAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(NoPhysicalDeleteAdmin):
    list_display = ("transaction_no", "biz_type", "biz_id", "payment_mode", "status", "provider_trade_no", "paid_at")
    list_filter = ("payment_mode", "status")
    search_fields = ("transaction_no", "provider_trade_no", "biz_id")
    readonly_fields = tuple(field.name for field in PaymentTransaction._meta.fields)


@admin.register(PayoutTransaction)
class PayoutTransactionAdmin(NoPhysicalDeleteAdmin):
    list_display = ("out_trade_no", "biz_type", "biz_id", "amount", "status", "provider_trade_no", "executed_at")
    list_filter = ("status",)
    search_fields = ("out_trade_no", "provider_trade_no", "biz_id")
    readonly_fields = tuple(field.name for field in PayoutTransaction._meta.fields)
