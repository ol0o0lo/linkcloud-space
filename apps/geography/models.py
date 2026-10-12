from __future__ import annotations

from django.contrib.gis.db import models
from django.core.exceptions import ValidationError

from apps.base.mixins import CreateUpdateTimeModelMixin


class MetroCity(CreateUpdateTimeModelMixin):
    name = models.CharField(max_length=64, unique=True, verbose_name="城市名称")
    province = models.CharField(max_length=64, verbose_name="省份")
    data_version = models.CharField(max_length=64, verbose_name="数据版本")
    imported_at = models.DateTimeField(null=True, blank=True, verbose_name="最近导入时间")

    class Meta:
        ordering = ["province", "name"]
        verbose_name = "地铁城市"
        verbose_name_plural = "地铁城市"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.province = self.province.strip()
        self.data_version = self.data_version.strip()
        self.full_clean()
        super().save(*args, **kwargs)


class MetroLine(CreateUpdateTimeModelMixin):
    city = models.ForeignKey(MetroCity, on_delete=models.PROTECT, related_name="lines", verbose_name="城市")
    name = models.CharField(max_length=64, verbose_name="线路名称")
    color = models.CharField(max_length=16, blank=True, default="", verbose_name="线路颜色")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="排序")
    is_loop = models.BooleanField(default=False, verbose_name="是否环线")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")
    stations = models.ManyToManyField("MetroStation", through="MetroLineStation", related_name="lines")

    class Meta:
        ordering = ["sort_order", "name", "pk"]
        verbose_name = "地铁线路"
        verbose_name_plural = "地铁线路"
        constraints = [models.UniqueConstraint(fields=["city", "name"], name="metro_line_city_name_unique")]

    def __str__(self):
        return f"{self.city.name} {self.name}"

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.color = self.color.strip()
        self.full_clean()
        super().save(*args, **kwargs)


class MetroStation(CreateUpdateTimeModelMixin):
    city = models.ForeignKey(MetroCity, on_delete=models.PROTECT, related_name="stations", verbose_name="城市")
    name = models.CharField(max_length=64, verbose_name="站点名称")
    aliases = models.JSONField(default=list, blank=True, verbose_name="别名")
    district = models.CharField(max_length=64, blank=True, default="", verbose_name="行政区")
    address = models.CharField(max_length=255, blank=True, default="", verbose_name="地址")
    location = models.PointField(srid=4326, geography=True, spatial_index=True, verbose_name="站点位置")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")

    class Meta:
        ordering = ["name", "pk"]
        verbose_name = "地铁站点"
        verbose_name_plural = "地铁站点"
        constraints = [models.UniqueConstraint(fields=["city", "name"], name="metro_station_city_name_unique")]

    def __str__(self):
        return f"{self.city.name} {self.name}"

    def clean(self):
        super().clean()
        if not isinstance(self.aliases, list) or any(not isinstance(item, str) for item in self.aliases):
            raise ValidationError({"aliases": "站点别名必须是字符串列表。"})
        if self.location and self.location.srid != 4326:
            raise ValidationError({"location": "站点坐标必须使用 WGS84（SRID 4326）。"})

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.aliases = list(dict.fromkeys(item.strip() for item in self.aliases if item.strip()))
        self.district = self.district.strip()
        self.address = self.address.strip()
        self.full_clean()
        super().save(*args, **kwargs)


class MetroLineStation(CreateUpdateTimeModelMixin):
    line = models.ForeignKey(MetroLine, on_delete=models.PROTECT, related_name="station_links", verbose_name="线路")
    station = models.ForeignKey(MetroStation, on_delete=models.PROTECT, related_name="line_links", verbose_name="站点")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="线路内排序")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")

    class Meta:
        ordering = ["sort_order", "pk"]
        verbose_name = "线路站点"
        verbose_name_plural = "线路站点"
        constraints = [models.UniqueConstraint(fields=["line", "station"], name="metro_line_station_unique")]

    def __str__(self):
        return f"{self.line} - {self.station.name}"

    def clean(self):
        super().clean()
        if self.line_id and self.station_id and self.line.city_id != self.station.city_id:
            raise ValidationError("线路与站点必须属于同一城市。")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
