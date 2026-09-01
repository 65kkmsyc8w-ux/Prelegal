"""The static export is copied into the image, so these pass in the Docker test
stage and fail against a mounted source tree that has never been built."""


def test_the_root_serves_the_built_export(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "/_next/static/" in response.text


def test_the_login_route_resolves(client):
    # trailingSlash: true is what makes this a login/index.html the mount finds.
    assert client.get("/login/").status_code == 200


def test_the_api_is_reachable_past_the_catch_all_mount(client):
    """StaticFiles is mounted at / and answers everything. A route registered
    after it would be unreachable, and this is what would catch that."""
    assert client.get("/api/health").status_code == 200


def test_an_unknown_path_is_not_found(client):
    assert client.get("/no-such-page").status_code == 404
