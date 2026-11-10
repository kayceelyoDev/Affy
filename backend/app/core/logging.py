import re
import logging
import structlog

# Patterns and their safe replacement templates
REDACTION_PATTERNS = [
    (re.compile(r"(?i)(bearer\s+)[a-zA-Z0-9_\-\.]{15,}"), r"\1[REDACTED]"),
    (re.compile(r"(?i)(api[_-]?key[\s:=]+)[a-zA-Z0-9_\-]{15,}"), r"\1[REDACTED]"),
    (re.compile(r"(?i)(token[\s:=]+)[a-zA-Z0-9_\-]{15,}"), r"\1[REDACTED]"),
    (re.compile(r"[0-9]{8,10}:[a-zA-Z0-9_-]{35}"), "[REDACTED_BOT_TOKEN]"),
]

def redact_sensitive_data(_, __, event_dict):
    for key, value in list(event_dict.items()):
        if isinstance(value, str):
            for pattern, repl in REDACTION_PATTERNS:
                try:
                    value = pattern.sub(repl, value)
                except Exception:
                    pass
            event_dict[key] = value
    return event_dict

def configure_logging(debug: bool = False):
    logging.basicConfig(
        format="%(message)s",
        level=logging.DEBUG if debug else logging.INFO,
    )
    
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            redact_sensitive_data,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer() if not debug else structlog.dev.ConsoleRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

logger = structlog.get_logger("autopilot")
