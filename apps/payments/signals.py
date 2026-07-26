from django.dispatch import Signal

payment_succeeded = Signal()
payout_succeeded = Signal()
payout_failed = Signal()
