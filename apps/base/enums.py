from django.db import models


class ChoicesMixin(models.TextChoices):
    @classmethod
    def get_choices(cls):
        return cls.choices

    @classmethod
    def get_django_choices(cls):
        return cls.choices

    @classmethod
    def get_values(cls):
        return cls.values

    @classmethod
    def get_labels(cls):
        return cls.labels

    @classmethod
    def get_choice_label(cls, value):
        return cls(value).label if value in cls.values else value
