from django.db import models


class StrChoices(models.TextChoices):
    @classmethod
    def get_choice_label(cls, value):
        return cls(value).label if value in cls.values else value


class IntChoices(models.IntegerChoices):
    @classmethod
    def get_choice_label(cls, value):
        return cls(value).label if value in cls.values else value
