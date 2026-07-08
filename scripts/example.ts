import { Logger } from "../main.ts";
import { delay } from "@std/async";

const logger = new Logger({
  prefix: "@m234/logger",
  defaultTaskOptions: { suffixDuration: 0n, interactive: true },
});

logger.info("Info message.");
logger.warn("Warn message.");
logger.error("Error message.");
logger.success("Success message.");

logger.println("");

await delay(500);

logger.task({ text: "Instant" }).startRunner(() => {});
const task1 = logger.task({ text: "Processing 1/3" }).start();
setTimeout(() => task1.end("completed"), 3000);

const task2 = logger.task({ text: "Processing 2/3" })
  .start();
setTimeout(() => task2.end("aborted"), 7000);

const task3 = logger.task({ text: "Processing 3/3" }).start();
const task31 = logger.task({ text: "Sub-task", indent: 1 }).start();
const task311 = logger.task({ text: "Sub-sub-task", indent: 2 }).start();
setTimeout(() => task311.end("completed"), 200);
setTimeout(() => task31.end("completed"), 200);
setTimeout(() => {
  task3.end("failed");
}, 4000);

logger.task({ text: "Thinking" }).startRunner(() => "skipped");
