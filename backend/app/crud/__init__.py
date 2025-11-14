# app/crud/__init__.py
"""
Robust loader for CRUD modules. Tries to import the common module names
(users, user, crud) and exposes whichever one is present as `crud`.
This avoids hard crashes when filenames differ slightly.
"""
from importlib import import_module

_candidates = ("users", "user", "crud")
_loaded = None
for name in _candidates:
    try:
        # Use relative import so package works when imported as `app.crud`
        _loaded = import_module(f".{name}", __package__)
        break
    except ModuleNotFoundError:
        continue

if _loaded is None:
    raise ImportError(
        "Could not find CRUD implementation module (tried users, user, crud) in app/crud/"
    )

# Re-export symbols from the loaded module for convenience
from . import users as default_module  # type: ignore
# if you want to expose everything:
try:
    __all__ = getattr(_loaded, "__all__")
except Exception:
    __all__ = [n for n in dir(_loaded) if not n.startswith("_")]

# Optionally expose the module under a common name
crud = _loaded
