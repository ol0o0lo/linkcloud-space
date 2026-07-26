from django.dispatch import receiver

from apps.payments.models import PaymentTransaction
from apps.payments.signals import payment_succeeded
from apps.subscriptions.services import fulfill_saas_order_payment


@receiver(payment_succeeded, sender=PaymentTransaction, dispatch_uid="subscriptions.fulfill_saas_order_payment")
def fulfill_saas_order_payment_on_success(sender, payment, **kwargs):
    fulfill_saas_order_payment(payment=payment)
