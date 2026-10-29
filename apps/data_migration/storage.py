from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateMigrationStorage(FileSystemStorage):
    """迁移包含内部业务数据，独立于可能公开的媒体存储。"""

    def __init__(self):
        super().__init__(file_permissions_mode=0o600, directory_permissions_mode=0o700)

    @property
    def base_location(self):
        root = Path(getattr(settings, "DATA_MIGRATION_PRIVATE_ROOT", "") or Path(settings.BASE_DIR) / ".private" / "data-migration")
        return str(root if root.is_absolute() else Path(settings.BASE_DIR) / root)

    @property
    def location(self):
        return str(Path(self.base_location).resolve())

    def url(self, name):
        raise ValueError("迁移包只能经组织鉴权接口读取。")
