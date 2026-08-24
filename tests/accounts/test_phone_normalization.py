import pytest

from apps.accounts.constants import PhoneCountryCode
from apps.accounts.models import User, normalize_phone, split_phone


@pytest.mark.parametrize("country_code", PhoneCountryCode.values)
def test_split_phone_recognizes_supported_explicit_country_codes(country_code):
    national_number = "2025550123"

    assert split_phone(f"{country_code}{national_number}") == (
        country_code,
        national_number,
    )


def test_split_phone_removes_phone_separators_without_losing_country_code():
    assert split_phone("+44 20-7946-0958") == ("+44", "2079460958")
    assert normalize_phone("+44 20-7946-0958") == "+442079460958"


def test_split_phone_keeps_mainland_mobile_compatibility_without_country_code():
    assert split_phone("13800138000") == ("+86", "13800138000")


def test_split_phone_does_not_support_country_code_without_plus_sign():
    assert split_phone("8613800138000") == ("", "8613800138000")


def test_split_phone_does_not_treat_us_number_without_plus_as_mainland_mobile():
    assert split_phone("12025550123") == ("", "12025550123")
    assert split_phone("+12025550123") == ("+1", "2025550123")


def test_split_phone_removes_foreign_domestic_trunk_prefix():
    assert split_phone("+81 090-1234-5678") == ("+81", "9012345678")
    assert normalize_phone("+81 090-1234-5678") == "+819012345678"


@pytest.mark.django_db
def test_user_stores_supported_foreign_phone_in_split_fields():
    user = User(username="foreign-phone")

    user.set_phone_number("+12025550123", verified=True)
    user.save()

    assert user.phone_country_code == "+1"
    assert user.phone_national_number == "2025550123"
    assert user.phone == "+12025550123"
    assert user.phone_verified is True
