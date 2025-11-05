import { Logger, type Task } from "../main.ts";
import { delay } from "@std/async";

const logger = new Logger({ prefix: "@m234/logger" });
const list: Task[] = [];
for (let i = 0; i < 20; i++) {
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
}, 1);
