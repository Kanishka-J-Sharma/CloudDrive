from . import db
from datetime import datetime


class User(db.Model):
    __tablename__ = "users"

    id           = db.Column(db.Integer, primary_key=True)
    email        = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    owned_files  = db.relationship("File", back_populates="owner", lazy="dynamic")
    shared_with  = db.relationship("FileShare", back_populates="shared_with_user", lazy="dynamic")

    def to_dict(self):
        return {"id": self.id, "email": self.email, "created_at": self.created_at.isoformat()}


class File(db.Model):
    __tablename__ = "files"

    # VULN: Sequential integer primary key.
    # An authenticated attacker can enumerate every file by incrementing the ID
    # (IDOR — Insecure Direct Object Reference).  Using UUIDs would make
    # enumeration computationally infeasible.
    id           = db.Column(db.Integer, primary_key=True)
    owner_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    filename     = db.Column(db.String(512), nullable=False)
    s3_key       = db.Column(db.String(1024), nullable=False)
    size_bytes   = db.Column(db.BigInteger, default=0)
    content_type = db.Column(db.String(255), default="application/octet-stream")
    uploaded_at  = db.Column(db.DateTime, default=datetime.utcnow)

    owner  = db.relationship("User", back_populates="owned_files")
    shares = db.relationship("FileShare", back_populates="file", lazy="dynamic",
                             cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":           self.id,
            "filename":     self.filename,
            "size_bytes":   self.size_bytes,
            "content_type": self.content_type,
            "uploaded_at":  self.uploaded_at.isoformat(),
            "owner_id":     self.owner_id,
        }


class FileShare(db.Model):
    __tablename__ = "file_shares"

    id                   = db.Column(db.Integer, primary_key=True)
    file_id              = db.Column(db.Integer, db.ForeignKey("files.id"), nullable=False)
    shared_with_user_id  = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    permission           = db.Column(db.String(10), nullable=False, default="read")  # "read" | "edit"
    shared_at            = db.Column(db.DateTime, default=datetime.utcnow)

    file              = db.relationship("File", back_populates="shares")
    shared_with_user  = db.relationship("User", back_populates="shared_with")

    __table_args__ = (
        db.UniqueConstraint("file_id", "shared_with_user_id", name="uq_file_share"),
    )

    def to_dict(self):
        return {
            "file_id":    self.file_id,
            "shared_with": self.shared_with_user_id,
            "permission": self.permission,
            "shared_at":  self.shared_at.isoformat(),
        }
