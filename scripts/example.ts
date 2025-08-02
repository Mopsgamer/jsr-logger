import { Logger } from "../main.ts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
using logger = new Logger("@m234/logger");

logger.info("Info message.");
logger.warn("Warn message.");
logger.error("Error message.");
logger.success("Success message.");

logger.println("");

logger.start("Action");
await wait(1500)
logger.end("completed");
logger.start("Action");
await wait(1500)
logger.end("skipped");
logger.start("Action");
await wait(1500)
logger.end("aborted");
logger.start("Action");
await wait(1500)
logger.end("failed");
