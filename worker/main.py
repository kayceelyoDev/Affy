import time
import structlog

logger = structlog.get_logger("worker")

def main():
    logger.info("Affiliate Autopilot Worker service starting...")
    while True:
        time.sleep(10)

if __name__ == "__main__":
    main()
