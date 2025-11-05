import { sprintTask, Task, type TaskOptions } from "../main.ts";
import ora, { type Ora } from "npm:ora";

class OraTask extends Task {
  spinner: Ora;
  constructor(options: TaskOptions) {
    super(options);
    this.spinner = ora();
  }
  override sprint(): string {
    if (this.disabled) return "";
    let sprint = sprintTask(this.prefix, this.text)[this.state];
    if (this.state === "started") sprint += " " + this.spinner.frame();
    return Task.indent(this) + sprint;
  }

  override [Symbol.dispose]() {
    super[Symbol.dispose]();
  }
}

const task = new OraTask({
  text: "Ora spinner suffix example",
  prefix: "@m234/logger",
}).start();
const subtask = new OraTask({
  text: "Ora spinner suffix example 3",
  prefix: "@m234/logger",
  indent: 1,
}).start();
const task2 = new OraTask({
  text: "Ora spinner suffix example 2",
  prefix: "@m234/logger",
}).start();
setTimeout(() => {
  task.end("completed");
  task2.end("skipped");
}, 3000);
setTimeout(() => {
  subtask.end("completed");
}, 5000);
