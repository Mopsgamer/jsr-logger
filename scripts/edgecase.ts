import { Logger } from "../main.ts";
import { delay } from "@std/async";

const logger = new Logger({ prefix: "@m234/logger" });

await delay(500);

/*
Plan:
1. create tasks: A and B. start both tasks.
2. set B task to "completed".
3. after 100 ms set B to "skipped".
*/

let taskA = logger.task({ text: "Task A" }).start();
let taskB = logger.task({ text: "Task B" }).start();

taskB.end("completed");
await delay(100);
taskB.end("skipped");
await delay(100);
taskA.end("completed");
