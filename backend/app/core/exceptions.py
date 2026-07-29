import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.core.logging_config import get_request_id

logger = logging.getLogger(__name__)


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = get_request_id()
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path} "
        f"(request_id={request_id}): {exc}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_server_error",
                "message": "An unexpected error occurred. Please try again later.",
            }
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(Exception, global_exception_handler)