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
import { list, mutex, renderer } from "./render.ts";

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
 * Wraps a message for a given log level.
 * @param prefix - The prefix to use.
 * @param message - The message to format.
 * @param level - The log level.
 * @returns A formatted string.
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
 * Wraps a message for a given synthetic task.
 * @param prefix - The prefix to use.
 * @param text - The task text.
 * @returns A structure representing the formatted messages for each task state.
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
 * Enum representing the starting states of the task.
 */
export type TaskStateStart = "started" | "idle";

/**
 * Enum representing the end states of the task.
 */
export type TaskStateEnd = "completed" | "aborted" | "failed" | "skipped";

/**
 * Enum representing the possible states of the task.
 */
export type TaskState = TaskStateStart | TaskStateEnd;

/**
 * Task callback.
 */
export type TaskRunner<R> = (options: { task: Task; list: Task[] }) => R;

/**
 * Logger levels for formatted console output.
 */
export type LogLevel = "info" | "warn" | "error" | "success";

/**
 * Options for the Logger class.
 */
export type LoggerOptions = {
  /**
   * Wrapped in square brackets.
   */
  prefix: string;
  /**
   * Whether the logging is disabled.
   * @defult false
   */
  disabled?: boolean;
};

/**
 * Options for the Task class.
 */
export type TaskOptions = LoggerOptions & {
  /**
   * Task appearance text.
   */
  text: string;
  /**
   * Initial task state.
   * @default "idle"
   */
  state?: TaskState;
};

type SetOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Options for creating a subtask.
 */
export type SubtaskOptions = SetOptional<TaskOptions, "prefix">;

/**
 * Sticky process state logger. Default state is "idle", which makes it invisible.
 */
export class Task implements Disposable {
  /**
   * Formats a list of tasks.
   * @returns A formatted string that ends with a new line if there are any visible tasks.
   */
  static sprintList(): string {
    const visibleTasks = list.filter((task) => task.state !== "idle");
    let result = "";
    if (visibleTasks.length > 0) {
      for (const task of visibleTasks) {
        result += task.sprint() + "\n";
      }
    }
    return result;
  }

  /**
   * Whether the task is disabled.
   */
  disabled: boolean = false;

  /**
   * The current state of the task.
   */
  state: TaskState = "idle";
  /**
   * The state to set when the task is disposed.
   */
  disposeState: TaskState = "completed";

  /**
   * The prefix for the task.
   */
  prefix: string;
  /**
   * Task appearance text.
   */
  text: string;

  constructor(options: TaskOptions) {
    this.state = options.state ?? "idle";
    this.prefix = options.prefix;
    this.text = options.text;
    this.disabled = options.disabled ?? false;
    list.push(this);
    renderer();
  }

  /**
   * Formats the task for logging.
   * @returns A formatted string.
   */
  sprint(): string {
    if (this.disabled) return "";
    return sprintTask(this.prefix, this.text)[this.state];
  }

  /**
   * Sets the task state to "started".
   * @return The task instance for chaining.
   */
  start(): Task {
    this.state = "started";
    return this;
  }

  /**
   * Sets the task state to an end state.
   * Refreshing will be continued until all tasks are in an end state.
   * @param state - The end state.
   * @return The task instance for chaining.
   */
  end(state: TaskStateEnd): Task {
    this.state = state;
    return this;
  }

  /**
   * Runs the task with a given runner function.
   * Refreshing will be continued until all tasks are in an end state.
   * @param runner - A function that returns an end state.
   * @returns The task instance for chaining.
   */
  async startRunner(
    runner:
      | TaskRunner<TaskStateEnd | Promise<TaskStateEnd>>
      | Promise<TaskStateEnd>,
  ): Promise<Task> {
    this.state = "started";
    const state = runner instanceof Promise
      ? await runner
      : await runner({ task: this, list: [...list] });
    this.state = state;
    return this;
  }

  [Symbol.dispose]() {
    this.state = this.disposeState;
  }
}

/**
 * Format type representing the task sprint messages.
 */
export type TaskSprint = {
  [key in TaskState]: string;
};

/**
 * Implements logging methods and task creation.
 */
export class Logger {
  /**
   * Wrapped in square brackets.
   * A string to prefix all logging methods, except {@link Logger.print} and {@link Logger.println}.
   * Affects {@link Logger.task}.
   */
  private prefix: string;

  /**
   * Whether the logger is disabled.
   * Affects all logging methods, including {@link Logger.print} and {@link Logger.println}.
   * Affects {@link Logger.task}.
   */
  public disabled: boolean;

  constructor(options: LoggerOptions) {
    this.prefix = `[${options.prefix}]`;
    this.disabled = options.disabled ?? false;
  }

  /**
   * Prints a message to the console without a new line when there are no ongoing tasks.
   * @param message - The message to print.
   * @returns A promise that resolves when the message has been printed.
   */
  async print(message: string): Promise<void> {
    if (this.disabled) return;
    await mutex.acquire();
    process.stdout.write(message);
    mutex.release();
  }

  /**
   * Same as {@link print}, but with a new line.
   * @param message - The message to print.
   * @return A promise that resolves when the message has been printed.
   */
  println(message: string): Promise<void> {
    return this.print(message + "\n");
  }

  /**
   * Formats a message for a given level.
   * @param message - The message to format.
   * @param level - The log level.
   * @returns A formatted string.
   */
  sprintLevel(
    message: string,
    level?: LogLevel,
  ): string {
    return sprintLevel(this.prefix, message, level);
  }

  /**
   * Formats a message for a synthetic task.
   * @param text - The task text.
   * @returns A structure representing the formatted messages for each task state.
   */
  sprintTask(text: string): TaskSprint {
    return sprintTask(this.prefix, text);
  }

  /**
   * Logs an informational message.
   * @param message - The message to log.
   * @returns A promise that resolves when the message has been printed.
   */
  info(message: string): Promise<void> {
    return this.println(this.sprintLevel(message, "info"));
  }

  /**
   * Logs an error message. Ends any ongoing continuous log as a failure.
   * @param message - The message to log.
   * @returns A promise that resolves when the message has been printed.
   */
  error(message: string): Promise<void> {
    return this.println(this.sprintLevel(message, "error"));
  }

  /**
   * Logs a warning message.
   * @param message - The message to log.
   * @returns A promise that resolves when the message has been printed.
   */
  warn(message: string): Promise<void> {
    return this.println(this.sprintLevel(message, "warn"));
  }

  /**
   * Logs a success message.
   * @param message - The message to log.
   * @returns A promise that resolves when the message has been printed.
   */
  success(message: string): Promise<void> {
    return this.println(this.sprintLevel(message, "success"));
  }

  /**
   * Starts a continuous log, printing a message with an ellipsis.
   * Can be ended by the `end` and other log-methods such as `info` and `error`.
   * @param options - Options for creating the task.
   * @returns The created task.
   */
  task(options: SubtaskOptions): Task {
    return new Task({
      prefix: this.prefix,
      disabled: this.disabled,
      ...options,
    });
  }
}
