from celery import shared_task

from apps.wallet.services import sync_processing_withdrawals


@shared_task
def sync_processing_withdrawals_task():
    sync_processing_withdrawals()
