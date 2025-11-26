# backend/dev_test_smtp.py
import os, smtplib, ssl
from pathlib import Path
from dotenv import load_dotenv

# Candidate .env locations (explicit)
candidates = [
    Path(__file__).resolve().parent / ".env",         # backend/.env
    Path(__file__).resolve().parent.parent / ".env", # project root .env
    Path.cwd() / ".env"                               # cwd .env
]

loaded = []
for p in candidates:
    if p.exists():
        load_dotenv(p)
        loaded.append(str(p))

# Also call plain load_dotenv to catch default behavior
load_dotenv()
# detect all env files that exist
for p in candidates:
    print("ENV candidate:", p, "exists=", p.exists())

print("Loaded env files (first-pass):", loaded)

# Print actual envs the process sees
u = (os.getenv("SMTP_USER") or "").strip()
p = (os.getenv("SMTP_PASS") or "").strip()
h = (os.getenv("SMTP_HOST") or "smtp.gmail.com").strip()
port = int((os.getenv("SMTP_PORT") or "465").strip())

print("PROCESS sees SMTP_USER repr:", repr(u))
print("PROCESS sees SMTP_PASS len:", len(p))
print("PROCESS sees SMTP_HOST,PORT:", h, port)

# If empty, attempt to read top lines from the first .env file found
for candidate in candidates:
    fp = Path(candidate)
    if fp.exists():
        try:
            print(f"--- head of {fp} ---")
            print(fp.read_text().splitlines()[:40])
        except Exception as e:
            print("Could not read file:", e)
        break

# Attempt login test
try:
    if port == 465:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(h, port, timeout=10, context=ctx) as s:
            s.login(u, p)
            print("TEST login ok (SSL)")
    else:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(h, port, timeout=10) as s:
            s.ehlo()
            s.starttls(context=ctx)
            s.ehlo()
            s.login(u, p)
            print("TEST login ok (STARTTLS)")
except Exception as e:
    try:
        code = e.smtp_code
        err = e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error
    except Exception:
        code, err = None, str(e)
    print("TEST login failed:", type(e).__name__, "code=", code, "err=", err)
