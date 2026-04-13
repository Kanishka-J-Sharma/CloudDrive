# ── Build stage ────────────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# VULN: Container runs as root.
# No "USER" directive means the process runs as UID 0.
# A successful RCE exploit grants the attacker root inside the container,
# making container breakout and privilege escalation significantly easier.
# Fix: add a non-root user and switch to it before CMD.

EXPOSE 5000

CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000"]
