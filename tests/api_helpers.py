def api_body(response):
    return response.json()


def api_data(response):
    body = api_body(response)
    assert body["code"] == 200
    assert body["message"] == "success"
    assert "timestamp" in body
    assert body["traceId"] == ""
    return body["data"]


def api_error(response):
    body = api_body(response)
    assert body["code"] != 200
    assert body["error"]
    assert body["message"]
    assert "data" in body
    assert "timestamp" in body
    assert body["traceId"] == ""
    return body
