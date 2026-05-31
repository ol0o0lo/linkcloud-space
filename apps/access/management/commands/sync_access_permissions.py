from django.core.management.base import BaseCommand

from apps.access.sync import sync_access_permissions


class Command(BaseCommand):
    help = "从 access 定义中同步权限与系统角色。"

    def handle(self, *args, **options):
        sync_access_permissions()
        self.stdout.write(self.style.SUCCESS("权限与系统角色同步完成。"))
