import { Logger, sprintTask, Task, type TaskOptions } from "../main.ts";
import ora, { type Ora } from "npm:ora";

class OraTask extends Task {
  spinner: Ora;
  constructor(options: TaskOptions) {
    super(options);
    this.spinner = ora();
  }
  override sprint(): string {
    if (this.logger.disabled) return "";
    let sprint = sprintTask(this.logger.prefix, this.text)[this.state];
    if (this.state === "started") sprint += " " + this.spinner.frame();
    return Task.indent(this) + sprint;
  }

  override [Symbol.dispose]() {
    super[Symbol.dispose]();
  }
}

const logger = new Logger({ prefix: "@m234/logger" });

const task = new OraTask({
  text: "Ora spinner suffix example",
  logger,
}).start();
const subtask = new OraTask({
  text: "Ora spinner suffix example 3",
  logger,
  indent: 1,
}).start();
const task2 = new OraTask({
  text: "Ora spinner suffix example 2",
  logger,
}).start();
setTimeout(() => {
  task.end("completed");
  task2.end("skipped");
}, 3000);
setTimeout(() => {
  subtask.end("completed");
}, 5000);
