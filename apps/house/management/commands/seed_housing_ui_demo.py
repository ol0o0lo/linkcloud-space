from django.conf import settings
from django.core.management import BaseCommand, CommandError

from apps.house.guangzhou_seed import GuangzhouReferenceDataError, seed_guangzhou_ui_data


class Command(BaseCommand):
    help = "同步真实广州行政区和地铁数据，并生成公开找房 UI 验收房源"

    def add_arguments(self, parser):
        parser.add_argument(
            "--allow-non-debug",
            action="store_true",
            help="允许在非 DEBUG 环境生成演示数据（默认禁止）",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["allow_non_debug"]:
            raise CommandError("该命令默认仅允许在 DEBUG 环境运行；确认需要时请追加 --allow-non-debug。")

        try:
            result = seed_guangzhou_ui_data()
        except GuangzhouReferenceDataError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            self.style.SUCCESS(
                f"广州真实数据已准备完成（{result.data_version}）："
                f"{result.metro_lines} 条地铁线路、{result.metro_stations} 个站点、{result.metro_links} 条线路站点关系；"
                f"{result.districts} 个行政区、{result.estates} 个小区、{result.buildings} 栋楼、{result.houses} 套上架房源；"
                f"房源归属组织：{result.organization_slug}。"
            )
        )
