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
function format(...args: unknown[]): string {
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
function sprintLevel(
  prefix: string,
  level?: LogLevel,
  ...args: unknown[]
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
  return `${prefix} ${format(...args)}`;
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
  padding?: string | TaskPadder;
};

let prevLog: string = "";
let logStack: string = "";
let n = 0;
/**
 * @returns `true` if any task is running.
 */
async function render(): Promise<boolean> {
  if (!isInteractive()) return renderCI();
  let runningTasks = Task.list.filter((task) => task.state === "started");
  const isLogIncomplete = runningTasks.length > 0;

  const list = Task.sprint();
  const changed = prevLog !== list
  if (changed) process.stdout.write("\x1B[1A\x1B[2K".repeat(n));
  process.stdout.write(logStack);
  n = Math.max(
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

let loggedTasksStarted = new Set<Task>();
let loggedTasks = new Set<Task>();
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
  const isLogIncomplete = loggedTasks.size !== Task.list.length;
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

type TaskPadder = (options: { task: Task; list: Task[] }) => string;

/**
 * Logging interface for asynchronous procedure.
 */
export class Task implements Disposable {
  static list: Task[] = [];

  static sprint(): string {
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
  padding: string | TaskPadder;

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
    const left = ` ${this.text} ...`;
    const taskSprint: TaskSprint = {
      started: magenta("- " + this.prefix) + left,
      aborted: sprintLevel(this.prefix, "warn", this.text) + " ... " +
        bold(yellow("aborted")),
      completed: sprintLevel(this.prefix, "success", this.text) + " ... " +
        bold(green("done")),
      failed: sprintLevel(this.prefix, "error", this.text) + " ... " +
        bold(red("failed")),
      skipped: gray("✓ " + this.prefix) + " " + this.text + " ... " +
        gray("skipped"),
    };
    return taskSprint;
  }

  task(...args: unknown[]): Task {
    const subtask = new Task({
      text: format(...args),
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
   * Same as {@link print}, but formats the given arguments.
   * @param args - The message and optional arguments to log.
   */
  printf(...args: unknown[]): void {
    const message = format(...args);
    this.print(message);
  }

  /**
   * Same as {@link printf}, but adds new line.
   * @param args - The message and optional arguments to log.
   */
  printfln(...args: unknown[]): void {
    const message = format(...args);
    this.print(message + "\n");
  }

  /**
   * Logs an informational message.
   * @param args - The message and optional arguments to log.
   */
  info(...args: unknown[]): void {
    this.println(sprintLevel(this.prefix, "info", ...args));
  }

  /**
   * Logs an error message. Ends any ongoing continuous log as a failure.
   * @param args - The message and optional arguments to log.
   */
  error(...args: unknown[]): void {
    this.println(sprintLevel(this.prefix, "error", ...args));
  }

  /**
   * Logs a warning message.
   * @param args - The message and optional arguments to log.
   */
  warn(...args: unknown[]): void {
    this.println(sprintLevel(this.prefix, "warn", ...args));
  }

  /**
   * Logs a success message.
   * @param args - The message and optional arguments to log.
   */
  success(...args: unknown[]): void {
    this.println(sprintLevel(this.prefix, "success", ...args));
  }

  /**
   * Starts a continuous log, printing a message with an ellipsis.
   * Can be ended by the `end` and other log-methods such as `info` and `error`.
   * @param args - The message and optional arguments to log.
   */
  task(...args: unknown[]): Task {
    return new Task({
      text: format(...args),
      prefix: this.prefix,
    });
  }
}
