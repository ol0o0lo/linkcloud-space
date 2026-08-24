import json

import pytest

from apps.accounts.models import User
from apps.settings.models import UserSetting
from apps.settings.table_columns import (
    USER_TABLE_COLUMNS_SETTING_KEY,
    TableColumnsValidationError,
    delete_user_table_columns,
    set_user_table_columns,
)
from tests.api_helpers import api_data


@pytest.fixture
def user(db):
    return User.objects.create_user(username="table-columns-user", password="secret")  # noqa: S106


def table_columns_url(table_key="rental.houses"):
    return f"/api/settings/user/table-columns/{table_key}/"


def put_json(client, url, data):
    return client.put(url, data=json.dumps(data), content_type="application/json")


@pytest.mark.django_db
def test_service_preserves_other_tables_and_removes_empty_setting(user):
    set_user_table_columns(user, "rental.houses", {"room_number": {"show": False, "order": 2}})
    set_user_table_columns(user, "rental.contacts", {"name": {"fixed": "left"}})

    setting = UserSetting.objects.get(user=user, key=USER_TABLE_COLUMNS_SETTING_KEY)
    assert setting.value == {
        "rental.houses": {"room_number": {"show": False, "order": 2}},
        "rental.contacts": {"name": {"fixed": "left"}},
    }

    delete_user_table_columns(user, "rental.houses")
    delete_user_table_columns(user, "rental.contacts")
    delete_user_table_columns(user, "rental.contacts")
    assert not UserSetting.objects.filter(user=user, key=USER_TABLE_COLUMNS_SETTING_KEY).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "value",
    [
        {"name": {"show": None}},
        {"name": {"fixed": "center"}},
        {"name": {"order": True}},
        {"name": {"order": float("inf")}},
        {"name": {"disable": True}},
        {"bad column": {"show": True}},
    ],
)
def test_service_rejects_invalid_column_state(user, value):
    with pytest.raises(TableColumnsValidationError):
        set_user_table_columns(user, "rental.houses", value)


@pytest.mark.django_db
def test_service_preserves_null_fixed_as_explicit_unpin(user):
    result = set_user_table_columns(user, "rental.houses", {"room_number": {"fixed": None}})
    assert result == {"room_number": {"fixed": None}}


@pytest.mark.django_db
def test_api_uses_ant_design_shape_and_filters_internal_setting_from_list(client, user):
    client.force_login(user)
    payload = {
        "room_number": {"show": True, "fixed": "left", "order": 0},
        "asking_rent": {"show": False, "order": 5},
    }

    response = put_json(client, table_columns_url(), payload)
    assert response.status_code == 200
    assert api_data(response) == payload
    assert api_data(client.get(f"/api/settings/user/{USER_TABLE_COLUMNS_SETTING_KEY}/")) == {
        "key": USER_TABLE_COLUMNS_SETTING_KEY,
        "value": {"rental.houses": payload},
    }
    assert api_data(client.get("/api/settings/user/")) == []


@pytest.mark.django_db
def test_api_reset_is_idempotent_and_reserved_generic_writes_are_rejected(client, user):
    client.force_login(user)
    put_json(client, table_columns_url(), {"room_number": {"show": False}})

    generic_url = f"/api/settings/user/{USER_TABLE_COLUMNS_SETTING_KEY}/"
    assert put_json(client, generic_url, {"value": {}}).status_code == 422
    assert client.delete(generic_url).status_code == 422

    assert client.delete(table_columns_url()).status_code == 200
    assert client.delete(table_columns_url()).status_code == 200
    assert client.get(generic_url).status_code == 404


@pytest.mark.django_db
def test_api_rejects_unknown_column_fields(client, user):
    client.force_login(user)
    response = put_json(client, table_columns_url(), {"room_number": {"disable": True}})
    assert response.status_code == 422
