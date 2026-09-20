import json
from pathlib import Path

from django.core.management import BaseCommand, CommandError

from apps.metro.importer import MetroImportError, import_metro_city


class Command(BaseCommand):
    help = "按城市整包导入地铁线路、站点和坐标"

    def add_arguments(self, parser):
        parser.add_argument("json_file", type=Path)

    def handle(self, *args, **options):
        path: Path = options["json_file"]
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            result = import_metro_city(payload)
        except (OSError, json.JSONDecodeError, MetroImportError) as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"{result.city} 导入完成："
                f"线路新增 {result.line_created}、更新 {result.line_updated}、停用 {result.line_deactivated}；"
                f"站点新增 {result.station_created}、更新 {result.station_updated}、停用 {result.station_deactivated}；"
                f"关联新增 {result.link_created}、更新 {result.link_updated}、停用 {result.link_deactivated}"
            )
        )

