import {
  blue,
  bold,
  getColorEnabled,
  gray,
  green,
  magenta,
  red,
  yellow,
} from "@std/fmt/colors";
import process from "node:process";
import { formatWithOptions } from "node:util";
import isInteractive from "is-interactive";
import { createMutex } from "@117/mutex";
import { delay } from "@std/async/delay";

/**
 * Formats the given arguments into a string.
 * @param args - The arguments to format.
 * @returns A formatted string.
 */
export function format(...args: unknown[]): string {
  const colors = getColorEnabled();
  const [message, ...other] = args;
  if (typeof message == "string") {
    return formatWithOptions({ colors }, message, ...other);
  }

  return args.map((a) => formatWithOptions({ colors }, "%o", a)).join(" ");
}

/**
 * Returns a formatted message string for a given level (no side effects).
 * @param level - The log level: 'info', 'warn', 'error', 'success', or undefined/null for no level.
 * @param args - The message and optional arguments to log.
 */
export function sprintLevel(
  prefix: string,
  message: string,
  level?: LogLevel,
): string {
  switch (level) {
    case "info":
      prefix = blue("ℹ " + prefix);
      break;
    case "warn":
      prefix = yellow("⚠ " + prefix);
      break;
    case "error":
      prefix = red("✗ " + prefix);
      break;
    case "success":
      prefix = green("✓ " + prefix);
      break;
    default:
      prefix = prefix;
      break;
  }
  return `${prefix} ${message}`;
}

/**
 * Returns a formatted message string for the end of a continuous log.
 */
export function sprintTask(prefix: string, text: string): TaskSprint {
  const left = ` ${text} ...`;
  const taskSprint: TaskSprint = {
    started: magenta("- " + prefix) + left,
    aborted: sprintLevel(prefix, text, "warn") + " ... " +
      bold(yellow("aborted")),
    completed: sprintLevel(prefix, text, "success") + " ... " +
      bold(green("done")),
    failed: sprintLevel(prefix, text, "error") + " ... " +
      bold(red("failed")),
    skipped: gray("✓ " + prefix) + " " + text + " ... " +
      gray("skipped"),
  };
  return taskSprint;
}

/**
 * Enum representing the starting states of the logger.
 */
export type TaskStateStart = "started" | "idle";

/**
 * Enum representing the end states of the logger.
 */
export type TaskStateEnd = "completed" | "aborted" | "failed" | "skipped";

/**
 * Enum representing the possible states of the logger.
 */
export type TaskState = TaskStateStart | TaskStateEnd;

type TaskRunner<R> = (options: { task: Task; list: Task[] }) => R;

/**
 * Logger levels for formatted console output.
 */
export type LogLevel = "info" | "warn" | "error" | "success";

export type LoggerOptions = {
  prefix: string;
  disabled?: boolean;
};

export type TaskOptions = LoggerOptions & {
  text: string;
  parent?: Task;
  state?: TaskState;
  padding?: string | TaskRunner<string>;
};

let prevLog: string = "";
let logStack: string = "";
let newLines = 0;
let loggedTasksStarted = new Set<Task>();
let loggedTasks = new Set<Task>();
/**
 * @returns `true` if any task is running.
 */
async function render(): Promise<boolean> {
  if (!isInteractive()) return renderCI();
  let runningTasks = Task.list.filter((task) => task.state === "started");
  const isLogIncomplete = runningTasks.length > 0;

  const list = Task.sprintList();
  const changed = prevLog !== list;
  if (changed) process.stdout.write("\x1B[1A\x1B[2K".repeat(newLines));
  process.stdout.write(logStack);
  newLines = Math.max(
    0,
    ((logStack + list).match(
      new RegExp(`\\n|[^\\n]{${process.stdout.columns}}`, "g"),
    ) ?? []).length,
  );
  logStack = "";
  if (changed) {
    process.stdout.write(list);
  }
  prevLog = list;
  return isLogIncomplete;
}

async function renderCI(): Promise<boolean> {
  for (const task of Task.list) {
    if (task.state === "idle") continue;
    if (task.state === "started") {
      if (loggedTasksStarted.has(task)) continue;
      loggedTasksStarted.add(task);
    } else {
      if (loggedTasks.has(task)) continue;
      loggedTasks.add(task);
    }

    process.stdout.write(task.sprint()[task.state] + "\n");
  }
  const isLogIncomplete = Task.list.every((task) =>
    loggedTasks.has(task) && loggedTasksStarted.has(task)
  );
  return isLogIncomplete;
}

const rendererMutex = createMutex();
const renderer = async function () {
  await rendererMutex.acquire();
  process.stdout.write("\x1B[?25l");
  for (;;) {
    await delay(0);
    if (!await render()) break;
  }
  await render();
  process.stdout.write("\x1B[?25h");

  rendererMutex.release();
};

/**
 * Logging interface for asynchronous procedure.
 */
export class Task implements Disposable {
  static list: Task[] = [];

  static sprintList(): string {
    const visibleTasks = Task.list.filter((task) => task.state !== "idle");
    let result = "";
    if (visibleTasks.length > 0) {
      let prevTask: Task | undefined;
      for (const task of visibleTasks) {
        if (prevTask && task.parent && prevTask === task.parent) {
          const padding = typeof task.padding === "string"
            ? task.padding.repeat(task.depth())
            : task.padding({ task, list: Task.list });
          result += padding;
        }
        result += task.sprint()[task.state as keyof TaskSprint];
        result += "\n";
        prevTask = task;
      }
    }
    return result;
  }
  state: TaskState = "idle";

  prefix: string;
  disabled: boolean;
  text: string;
  parent?: Task;
  padding: string | TaskRunner<string>;

  constructor(options: TaskOptions) {
    this.state = options.state ?? "idle";
    this.prefix = options.prefix;
    this.disabled = options.disabled ?? false;
    this.text = options.text;
    this.parent = options.parent;
    this.padding = options.padding ?? "  | ";
    if (this.parent) {
      Task.list.splice(Task.list.indexOf(this.parent), 0, this);
    } else {
      Task.list.push(this);
    }
    renderer();
  }

  depth(): number {
    let level = 0;
    let current = this.parent;
    while (current) {
      level++;
      current = current.parent;
    }
    return level;
  }

  /**
   * Returns a formatted message string for the end of a continuous log.
   */
  sprint(): TaskSprint {
    return sprintTask(this.prefix, this.text);
  }

  /**
   * Sets the task state to "started" and begins rendering.
   */
  start(): Task {
    if (this.disabled) return this;
    this.state = "started";
    return this;
  }

  /**
   * Sets the task state to "completed" and ends rendering.
   */
  end(state: TaskStateEnd): Task {
    if (this.disabled) return this;
    this.state = state;
    return this;
  }

  /**
   * Runs the task with a given runner function.
   */
  startRunner(runner: TaskRunner<TaskStateEnd>): Task {
    this.state = "started";
    this.state = runner({ task: this, list: Task.list });
    return this;
  }

  /**
   * Creates a subtask under the current task.
   */
  task(options: Omit<TaskOptions, "prefix">): Task {
    const subtask = new Task({
      ...options,
      prefix: this.prefix,
    });
    subtask.parent = this;
    return subtask;
  }

  [Symbol.dispose]() {
    this.state = "completed";
  }
}

/**
 * Type representing the task sprint messages for the logger.
 */
export type TaskSprint = {
  [key in "started" | TaskStateEnd]: string;
};

/**
 * Logger class for formatted console output.
 */
export class Logger {
  /**
   * A string to prefix all log messages. Wrapped in square brackets.
   */
  private prefix: string;

  /**
   * Whether the logger is disabled.
   */
  public disabled: boolean;

  /**
   * Creates a new Logger instance.
   * @param prefix - A string to prefix all log messages.
   * @param disabled - Whether the logger is disabled. Defaults to `false`.
   */
  constructor(options: LoggerOptions) {
    this.prefix = `[${options.prefix}]`;
    this.disabled = options.disabled ?? false;
  }

  /**
   * Prints a message to the console without a new line. Ends any ongoing continuous log as a success.
   * @param message - The message to print.
   */
  print(message: string): void {
    if (this.disabled) return;
    process.stdout.write(message);
  }

  /**
   * Same as {@link print}, but adds new line.
   * @param message - The message to print.
   */
  println(message: string): void {
    this.print(message + "\n");
  }

  /**
   * Returns a formatted message string for a given level (no side effects).
   * @param level - The log level: 'info', 'warn', 'error', 'success', or undefined/null for no level.
   * @param args - The message and optional arguments to log.
   */
  sprintLevel(
    message: string,
    level?: LogLevel,
  ): string {
    return sprintLevel(this.prefix, message, level);
  }

  /**
   * Returns a formatted message string for the end of a continuous log.
   */
  sprintTask(text: string): TaskSprint {
    return sprintTask(this.prefix, text);
  }

  /**
   * Logs an informational message.
   * @param args - The message and optional arguments to log.
   */
  info(message: string): void {
    this.println(this.sprintLevel(message, "info"));
  }

  /**
   * Logs an error message. Ends any ongoing continuous log as a failure.
   * @param args - The message and optional arguments to log.
   */
  error(message: string): void {
    this.println(this.sprintLevel(message, "error"));
  }

  /**
   * Logs a warning message.
   * @param args - The message and optional arguments to log.
   */
  warn(message: string): void {
    this.println(this.sprintLevel(message, "warn"));
  }

  /**
   * Logs a success message.
   * @param args - The message and optional arguments to log.
   */
  success(message: string): void {
    this.println(this.sprintLevel(message, "success"));
  }

  /**
   * Starts a continuous log, printing a message with an ellipsis.
   * Can be ended by the `end` and other log-methods such as `info` and `error`.
   * @param args - The message and optional arguments to log.
   */
  task(options: Omit<TaskOptions, "prefix">): Task {
    return new Task({
      ...options,
      prefix: this.prefix,
    });
  }
}
