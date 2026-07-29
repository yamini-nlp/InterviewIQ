import json
import logging
import sys
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional

request_id_ctx_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
user_id_ctx_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)


def new_request_id() -> str:
    return str(uuid.uuid4())


def set_request_id(request_id: Optional[str]) -> None:
    request_id_ctx_var.set(request_id)


def get_request_id() -> Optional[str]:
    return request_id_ctx_var.get()


def set_user_id(user_id: Optional[str]) -> None:
    user_id_ctx_var.set(user_id)


def get_user_id() -> Optional[str]:
    return user_id_ctx_var.get()


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        request_id = get_request_id()
        if request_id:
            payload["request_id"] = request_id

        user_id = get_user_id()
        if user_id:
            payload["user_id"] = user_id

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def configure_logging(level: int = logging.INFO) -> None:
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(JsonLogFormatter())
    root_logger.addHandler(stream_handler)

    for noisy_logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        noisy_logger = logging.getLogger(noisy_logger_name)
        noisy_logger.handlers = []
        noisy_logger.propagate = True