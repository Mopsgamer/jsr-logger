import { Logger } from "../main.ts";
import { delay } from "@std/async";

const logger = new Logger({ prefix: "@m234/logger" });

logger.info("Info message.");
logger.warn("Warn message.");
logger.error("Error message.");
logger.success("Success message.");

logger.println("");

await delay(500);

let task1 = logger.task({ text: "Processing 1/3" }).start();
setTimeout(() => task1.end("completed"), 3000);

let task2 = logger.task({ text: "Processing 2/3" }).start();
setTimeout(() => task2.end("aborted"), 7000);

let task3 = logger.task({ text: "Processing 3/3" }).start();
let task31 = logger.task({ text: "Sub-task" }).start();
let task311 = logger.task({ text: "Sub-sub-task" }).start();
setTimeout(() => task311.end("completed"), 200);
setTimeout(() => task31.end("completed"), 200);
setTimeout(() => {
  task3.end("skipped");
}, 4000);

let task11 = logger.task({ text: "Thinking" }).startRunner(() => "skipped");

await delay(1000);
logger.success("DOing");
await delay(9000);
logger.success("DONE");
