import time
import structlog

logger = structlog.get_logger("bot")

def main():
    logger.info("Affiliate Autopilot Telegram Bot polling service starting...")
    while True:
        time.sleep(10)

if __name__ == "__main__":
    main()
