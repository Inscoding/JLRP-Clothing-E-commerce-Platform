# Smarter JLRP login & password-reset tests:
# - discovers endpoints from /openapi.json
# - falls back to common path guesses if discovery fails

import pytest
import httpx
import re
from typing import Optional

BASE_URL = "http://127.0.0.1:8000"
TEST_USER = {
    "username": "admin",
    "password": "secret_password",
    "email": "admin@example.com",
}

def find_path_for_openapi(openapi: dict, pattern: str) -> Optional[str]:
    """
    Search openapi paths for a key matching regex pattern.
    Return the best matching path or None.
    """
    paths = list(openapi.get("paths", {}).keys())
    pattern = re.compile(pattern, re.IGNORECASE)
    # prefer exact-ish matches, then contains
    exacts = [p for p in paths if pattern.search(p) and p.rstrip("/") == pattern.pattern.strip("^$")]
    if exacts:
        return exacts[0]
    contains = [p for p in paths if pattern.search(p)]
    return contains[0] if contains else None

async def discover_endpoints():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10) as ac:
        r = await ac.get("/openapi.json")
        r.raise_for_status()
        openapi = r.json()
    # possible name patterns to search for:
    login_candidates = [
        r"/auth/login", r"/auth/token", r"/token", r"/auth/signin", r"/signin", r"/auth/oauth/token"
    ]
    reset_request_candidates = [
        r"/auth/password-reset-request", r"/password-reset-request", r"/auth/password/request",
        r"/auth/password-reset", r"/password-reset", r"/auth/reset-password"
    ]
    # dynamic search: pick the first path containing "login" or "token" or "signin"
    # fallback: search candidates list
    def search(patterns):
        for pat in patterns:
            p = find_path_for_openapi(openapi, pat)
            if p:
                return p
        # broad search
        for p in openapi.get("paths",{}).keys():
            if re.search(r"(login|token|signin|auth/token)", p, re.I):
                return p
        return None

    login_path = search(login_candidates)
    reset_request_path = search(reset_request_candidates)

    return {
        "login_path": login_path,
        "reset_request_path": reset_request_path,
        "openapi_paths": list(openapi.get("paths", {}).keys())
    }

@pytest.mark.asyncio
async def test_discovery_and_login_flow():
    info = await discover_endpoints()
    print("\nDiscovered paths:", info["openapi_paths"])
    login_path = info["login_path"]
    reset_request_path = info["reset_request_path"]

    assert login_path is not None, f"Could not find login/token path in openapi. Paths: {info['openapi_paths']}"
    print("Using login path:", login_path)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10) as ac:
        # Attempt OAuth2 form-login first (common pattern)
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {"username": TEST_USER["username"], "password": TEST_USER["password"]}
        r = await ac.post(login_path, data=data, headers=headers)
        if r.status_code == 404 or r.status_code == 405:
            # try JSON fallback
            r = await ac.post(login_path, json={"username": TEST_USER["username"], "password": TEST_USER["password"]})
        assert r.status_code == 200, f"Login failed (path {login_path}): {r.status_code} {r.text}"
        # Accept JSON token or cookie
        try:
            j = r.json()
            assert isinstance(j, dict), f"Expected JSON response for login, got: {j}"
        except Exception:
            # ensure cookie header present if not JSON
            assert any(k.lower().startswith("set-cookie") for k in r.headers.keys()), "No token JSON or Set-Cookie in login response"

@pytest.mark.asyncio
async def test_password_reset_request_discovered():
    info = await discover_endpoints()
    reset_request_path = info["reset_request_path"]
    print("Discovered reset path:", reset_request_path)
    assert reset_request_path is not None, f"Could not find password-reset-request path. Paths: {info['openapi_paths']}"

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10) as ac:
        r = await ac.post(reset_request_path, json={"email": TEST_USER["email"]})
        # Accept 200 or 202 or 204 or 201 depending on implementation
        assert r.status_code in (200, 202, 201, 204), f"Password reset request failed: {r.status_code} {r.text}"
