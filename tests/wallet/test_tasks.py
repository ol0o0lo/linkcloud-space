from unittest.mock import patch

from django.test import TestCase

from apps.wallet.tasks import sync_processing_withdrawals_task


class WalletTaskTests(TestCase):
    @patch("apps.wallet.tasks.sync_processing_withdrawals")
    def test_sync_processing_withdrawals_task_calls_service(self, mock_sync):
        sync_processing_withdrawals_task()

        mock_sync.assert_called_once_with()
