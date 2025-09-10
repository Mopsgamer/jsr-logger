import { Logger, type Task } from "../main.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import process from "node:process";

const options = parseArgs(process.argv) as {count?: number, interval?: number}
options.count ??= 16;
options.interval ??= 1000 / 30;

console.log("(--interval) update interval: %f ms", options.interval.toFixed(2));
console.log("(--count) count: %d", options.count);

const logger = new Logger({ prefix: "@m234/logger" });
const list: Task[] = [];
for (let i = 0; i < options.count; i++) {
  const task = logger.task({ text: (i + 1).toString() }).start();
  list.push(task);
}

const states = [
  "started",
  "aborted",
  "completed",
  "failed",
  "skipped",
] as const;

setInterval(() => {
  const randomTask = list[Math.floor(Math.random() * list.length)];
  randomTask.state = states[Math.floor(Math.random() * states.length)];
  if (list.every((task) => task.state !== "started")) {
    randomTask.state = "started";
  }
}, options.interval);
