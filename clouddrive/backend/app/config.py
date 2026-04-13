import os
from datetime import timedelta


class Config:
    # ── Flask ──────────────────────────────────────────────────────────────────
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "dev-secret")
    FLASK_ENV  = os.environ.get("FLASK_ENV", "production")

    # ── Database ───────────────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI     = os.environ.get("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ── JWT ────────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-dev-secret")

    # VULN: 30-day expiry means a stolen token remains valid for a month.
    # There is also no server-side revocation list / blocklist, so logging
    # out does not actually invalidate the token — anyone who captures it
    # can continue using it until it expires naturally.
    JWT_EXPIRY = timedelta(days=int(os.environ.get("JWT_EXPIRY_DAYS", 30)))

    # ── AWS / S3 ───────────────────────────────────────────────────────────────
    # VULN: Credentials come from .env / environment variables instead of an
    # IAM instance role or AWS Secrets Manager.  If the .env file or process
    # environment is leaked (e.g. via a path-traversal or SSRF against the
    # metadata service), the long-lived key pair is fully exposed.
    AWS_ACCESS_KEY_ID     = os.environ.get("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
    AWS_REGION            = os.environ.get("AWS_REGION", "us-east-1")
    S3_BUCKET_NAME        = os.environ.get("S3_BUCKET_NAME")

    # Presigned URL lifetime (seconds)
    S3_PRESIGNED_EXPIRY = 3600
