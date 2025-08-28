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
import { createMutex, type Mutex } from "@117/mutex";
import { renderer } from "./render.ts";

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
    idle: "",
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

export type TaskRunner<R> = (options: { task: Task; list: Task[] }) => R;

export type TaskPadding = string | TaskRunner<string>;

/**
 * Logger levels for formatted console output.
 */
export type LogLevel = "info" | "warn" | "error" | "success";

export type LoggerOptions = {
  prefix: string;
  disabled?: boolean;
};

export type TaskOptions = Omit<LoggerOptions, "disabled"> & {
  text: string;
  parent?: Task;
  state?: TaskState;
  padding?: TaskPadding;
};

type SetOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type SubtaskOptions = SetOptional<TaskOptions, "prefix">;

/**
 * Logging interface for asynchronous procedure.
 */
export class Task implements Disposable {
  static list: Task[] = [];

  static mutex: Mutex = createMutex();

  static sprintList(): string {
    Task.list.sort((a, b) => a.parent === b ? 1 : b.parent === a ? -1 : 0);
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
        result += task.sprint();
        result += "\n";
        prevTask = task;
      }
    }
    return result;
  }

  state: TaskState = "idle";
  disposeState: TaskState = "completed";

  prefix: string;
  text: string;
  parent?: Task;
  padding: TaskPadding;

  constructor(options: TaskOptions) {
    this.state = options.state ?? "idle";
    this.prefix = options.prefix;
    this.text = options.text;
    this.parent = options.parent;
    this.padding = options.padding ?? "  | ";
    Task.list.push(this);
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
  sprint(): string {
    return sprintTask(this.prefix, this.text)[this.state];
  }

  /**
   * Sets the task state to "started" and begins rendering.
   */
  start(): Task {
    this.state = "started";
    return this;
  }

  /**
   * Sets the task state to "completed" and ends rendering.
   */
  end(state: TaskStateEnd): Task {
    this.state = state;
    return this;
  }

  /**
   * Runs the task with a given runner function.
   */
  async startRunner(
    runner:
      | TaskRunner<TaskStateEnd | Promise<TaskStateEnd>>
      | Promise<TaskStateEnd>,
  ): Promise<Task> {
    this.state = "started";
    const state = runner instanceof Promise
      ? await runner
      : await runner({ task: this, list: Task.list });
    this.state = state;
    return this;
  }

  /**
   * Creates a subtask under the current task.
   */
  task(options: SubtaskOptions): Task {
    const subtask = new Task({
      prefix: this.prefix,
      padding: this.padding,
      ...options,
      parent: this,
    });
    return subtask;
  }

  [Symbol.dispose]() {
    this.state = this.disposeState;
  }
}

/**
 * Type representing the task sprint messages for the logger.
 */
export type TaskSprint = {
  [key in TaskState]: string;
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
  async print(message: string): Promise<void> {
    if (this.disabled) return;
    await Task.mutex.acquire();
    process.stdout.write(message);
    Task.mutex.release();
  }

  /**
   * Same as {@link print}, but adds new line.
   * @param message - The message to print.
   */
  println(message: string): Promise<void> {
    return this.print(message + "\n");
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
  info(message: string): Promise<void> {
    return this.println(this.sprintLevel(message, "info"));
  }

  /**
   * Logs an error message. Ends any ongoing continuous log as a failure.
   * @param args - The message and optional arguments to log.
   */
  error(message: string): Promise<void> {
    return this.println(this.sprintLevel(message, "error"));
  }

  /**
   * Logs a warning message.
   * @param args - The message and optional arguments to log.
   */
  warn(message: string): Promise<void> {
    return this.println(this.sprintLevel(message, "warn"));
  }

  /**
   * Logs a success message.
   * @param args - The message and optional arguments to log.
   */
  success(message: string): Promise<void> {
    return this.println(this.sprintLevel(message, "success"));
  }

  /**
   * Starts a continuous log, printing a message with an ellipsis.
   * Can be ended by the `end` and other log-methods such as `info` and `error`.
   * @param args - The message and optional arguments to log.
   */
  task(options: SubtaskOptions): Task {
    return new Task({
      prefix: this.prefix,
      ...options,
    });
  }
}
