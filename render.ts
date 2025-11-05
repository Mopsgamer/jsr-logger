import isInteractive from "is-interactive";
import { Task } from "./main.ts";
import { delay } from "@std/async/delay";

let prevLog: string = "";
let newLines = 0;
let loggedTasksStarted = new Set<Task>();
let loggedTasks = new Set<Task>();
/**
 * @returns `true` if any task is running.
 */
export async function render(): Promise<boolean> {
  let runningTasks = Task.list.filter((task) => task.state === "started");
  const isLogIncomplete = runningTasks.length > 0;

  const list = Task.sprintList();
  const changed = prevLog !== list;
  if (changed) process.stdout.write("\x1B[1A\x1B[2K".repeat(newLines));
  newLines = (list.match(
    new RegExp(`\\n|[^\\n]{${process.stdout.columns}}`, "g"),
  ) ?? []).length;

  if (changed) {
    process.stdout.write(list);
  }
  prevLog = list;
  return isLogIncomplete;
}

export async function renderCI(): Promise<boolean> {
  for (const task of Task.list) {
    if (task.state === "idle") continue;
    if (task.state === "started") {
      if (loggedTasksStarted.has(task)) continue;
      loggedTasksStarted.add(task);
    } else {
      if (loggedTasks.has(task)) continue;
      loggedTasks.add(task);
    }

    process.stdout.write(task.sprint() + "\n");
  }
  const isLogIncomplete = Task.list.every((task) =>
    loggedTasks.has(task) && loggedTasksStarted.has(task)
  );
  return isLogIncomplete;
}

export let state = { noLoop: false };

export async function renderer(force = false) {
  if (state.noLoop && !force) return;
  const draw = () => isInteractive() ? render() : renderCI();
  await Task.mutex.acquire();
  process.stdout.write("\x1B[?25l");
  for (;;) {
    await delay(0);
    if (!await draw()) break;
  }
  await draw();
  process.stdout.write("\x1B[?25h");
  Task.mutex.release();
}
