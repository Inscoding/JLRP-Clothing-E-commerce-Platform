# list_routes.py
from importlib import import_module

# Import your FastAPI app
m = import_module("app.main")
app = getattr(m, "app")

# Print all routes
for r in sorted(app.routes, key=lambda x: x.path):
    methods = ",".join(sorted(getattr(r, "methods", [])))
    print(f"{r.path:<40}  methods: {methods}")
