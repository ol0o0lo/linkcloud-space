from django.dispatch import receiver

from apps.payments.models import PayoutTransaction
from apps.payments.signals import payout_failed, payout_succeeded
from apps.wallet.services import handle_payout_result


@receiver(payout_succeeded, sender=PayoutTransaction, dispatch_uid="wallet.handle_successful_payout")
def handle_successful_payout(sender, payout, **kwargs):
    handle_payout_result(payout=payout)


@receiver(payout_failed, sender=PayoutTransaction, dispatch_uid="wallet.handle_failed_payout")
def handle_failed_payout(sender, payout, **kwargs):
    handle_payout_result(payout=payout)
