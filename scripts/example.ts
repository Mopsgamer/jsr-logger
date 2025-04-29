import { Logger } from "../main.ts";

const logger = new Logger("@m234/logger");

logger.info("Info message.");
logger.warn("Warn message.");
logger.error("Error message.");
logger.success("Success message.");
logger.print("test");

logger.start("Action");
logger.end("aborted");
logger.start("Action");
logger.end("completed");
logger.start("Action");
logger.end("failed");
