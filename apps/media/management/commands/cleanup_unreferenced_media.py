from datetime import timedelta

from django.core.management.base import BaseCommand

from apps.media.services import cleanup_unreferenced_media


class Command(BaseCommand):
    help = "Cleanup MediaFile records and physical files that are no longer referenced by business models."

    def add_arguments(self, parser):
        parser.add_argument(
            "--older-than-hours",
            type=int,
            default=24,
            help="Only cleanup media created before this many hours. Defaults to 24.",
        )

    def handle(self, *args, **options):
        result = cleanup_unreferenced_media(older_than=timedelta(hours=options["older_than_hours"]))
        self.stdout.write(self.style.SUCCESS(f"Deleted {result.deleted_count} unreferenced media files."))
