from django.utils.translation import gettext_lazy as _

from apps.base.enums import ChoicesMixin


class Color(ChoicesMixin):
    RED = "red", _("红色")
    GREEN = "green", _("绿色")


class TestChoicesMixin:
    def test_get_choices(self):
        assert Color.get_choices() == [("red", "红色"), ("green", "绿色")]

    def test_get_django_choices(self):
        assert Color.get_django_choices() == Color.get_choices()

    def test_get_values(self):
        assert Color.get_values() == ["red", "green"]

    def test_get_labels(self):
        assert Color.get_labels() == ["红色", "绿色"]

    def test_get_choice_label_found(self):
        assert Color.get_choice_label("red") == "红色"

    def test_get_choice_label_not_found(self):
        assert Color.get_choice_label("unknown") == "unknown"
