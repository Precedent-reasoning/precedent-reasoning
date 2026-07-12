"""
Centralised logging configuration for AI Legal Search backend.

Call configure_logging() once at startup (in main.py).
All modules obtain their logger via logging.getLogger(__name__).
"""

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

SLOW_QUERY_THRESHOLD_S = 5.0  # log WARNING if any operation exceeds this

LOG_DIR = Path(__file__).parent / "logs"
LOG_FILE = LOG_DIR / "backend.log"


def configure_logging(level: str = "INFO") -> None:
    LOG_DIR.mkdir(exist_ok=True)
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)

    file_handler = RotatingFileHandler(
        LOG_FILE, maxBytes=10_000_000, backupCount=5
    )
    file_handler.setFormatter(formatter)

    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        handlers=[stream_handler, file_handler],
        force=True,
    )
    # Quieten noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("anthropic").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
