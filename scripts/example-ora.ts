import { Logger, type Task } from "../main.ts";
import ora from "npm:ora";
import isInteractive from "is-interactive";

const logger = new Logger({ prefix: "@m234/logger" });
const spinner = ora();
const task = logger.task({
  text: (isInteractive() ? spinner.frame() + " " : "") + "Ora spinner example.",
}).start();
const interval = !isInteractive() ? 0 : setInterval(() => {
  task.text = spinner.frame() + " Ora spinner example.";
}, spinner.interval);
setTimeout(() => {
  if (isInteractive()) clearInterval(interval);
  task.text = "Ora spinner example.";
  task.end("completed");
}, 3000);
