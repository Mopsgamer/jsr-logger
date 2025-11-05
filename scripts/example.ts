import { Logger } from "../main.ts";
import { delay } from "@std/async";

const logger = new Logger({ prefix: "@m234/logger" });

logger.info("Info message.");
logger.warn("Warn message.");
logger.error("Error message.");
logger.success("Success message.");

logger.println("");

await delay(500);

let task1 = logger.task("Processing 1/3");
task1.state = "started";
setTimeout(() => task1.state = "completed", 3000);

let task2 = logger.task("Processing 2/3");
task2.state = "started";
setTimeout(() => task2.state = "aborted", 7000);

let task3 = logger.task("Processing 3/3");
task3.state = "started";
let task31 = task3.task("Sub-task");
task31.state = "started";
let task311 = task31.task("Sub-sub-task");
task31.state = "started";
setTimeout(() => task311.state = "completed", 200);
setTimeout(() => task31.state = "completed", 200);
setTimeout(() => {
  task3.state = "skipped";
  task31.parent = task311.parent = undefined;
  task3.state = "idle";
}, 4000);
