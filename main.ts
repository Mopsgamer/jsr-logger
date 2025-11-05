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
import { mutex, renderer, taskList } from "./render.ts";
import isInteractive from "is-interactive";

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
 * Array of valid end states for tasks.
 */
export const taskStateEnd: ["failed", "completed", "aborted", "skipped"] = [
  "failed",
  "completed",
  "aborted",
  "skipped",
] as const;

/**
 * Enum representing the possible states of the task.
 */
export type TaskState = TaskStateStart | TaskStateEnd;

/**
 * Task callback.
 */
export type TaskRunner<R> = (options: { task: Task; list: Task[] }) => R;

/**
 * Union type representing any valid task runner.
 */
export type AnyRunner =
  | Promise<TaskStateEnd | void>
  | TaskRunner<TaskStateEnd | void>
  | TaskRunner<Promise<TaskStateEnd | void>>;

function catchState(e: unknown, disposeState: TaskStateEnd): TaskStateEnd {
  if (e === undefined) {
    return disposeState;
  }
  if (taskStateEnd.includes(e as TaskStateEnd)) {
    return e as TaskStateEnd;
  }
  return "failed";
}

/**
 * Starts a task with a given runner function.
 * @param task The task to start.
 * @param runner A function that returns an end state.
 */
export function startRunner(
  task: Task,
  runner: TaskRunner<TaskRunnerReturn>,
): Task;
export function startRunner(
  task: Task,
  runner: Promise<TaskRunnerReturn>,
): Promise<Task>;
export function startRunner(
  task: Task,
  runner: TaskRunner<Promise<TaskRunnerReturn>>,
): Promise<Task>;
export function startRunner(
  task: Task,
  runner: AnyRunner,
): Promise<Task> | Task {
  task.start();
  try {
    const state = runner instanceof Promise
      ? runner
      : runner({ task, list: [...taskList] });
    if (state instanceof Promise) {
      return new Promise<Task>((resolve, reject) => {
        Promise.resolve(state).then((state) => {
          resolve(task.end(state ?? task.disposeState));
        }).catch((e) => {
          resolve(task.end(catchState(e, task.disposeState)));
        });
      });
    } else {
      task.end(state ?? task.disposeState);
    }
  } catch (e) {
    task.end(catchState(e, task.disposeState));
  }
  return task;
}

/**
 * Wraps a task runner to log any exceptions using the provided logger.
 * @param logger - The logger to use for logging errors. The prefix used is the one set in the logger instance.
 * @param runner - The task runner or promise to wrap.
 * @param level - The log level to use for logging errors. Defaults to "error".
 */
export function printErrors(
  logger: Logger,
  runner: TaskRunner<TaskRunnerReturn>,
  level?: LogLevel,
): TaskRunner<TaskRunnerReturn>;
export function printErrors(
  logger: Logger,
  runner: Promise<TaskRunnerReturn>,
  level?: LogLevel,
): Promise<TaskRunnerReturn>;
export function printErrors(
  logger: Logger,
  runner: TaskRunner<Promise<TaskRunnerReturn>>,
  level?: LogLevel,
): TaskRunner<Promise<TaskRunnerReturn>>;
export function printErrors(
  logger: Logger,
  runner: AnyRunner,
  level: LogLevel = "error",
): any {
  return (async (options) => {
    try {
      if (runner instanceof Promise) {
        return await runner;
      }
      return await runner(options);
    } catch (e) {
      logger[level](format(e));
      throw e;
    }
  }) as TaskRunner<any>;
}

/**
 * Return type of the task runner.
 */
type TaskRunnerReturn = TaskStateEnd | void | never;

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
  /**
   * Final task state when using task as disposable.
   * @default "completed"
   */
  disposeState?: TaskStateEnd;
  /**
   * Indentation level.
   * @defult 0
   */
  indent?: number;
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
    const visibleTasks = taskList.filter((task) => task.state !== "idle");
    let result = "";
    if (visibleTasks.length > 0) {
      for (const task of visibleTasks) {
        result += task.sprint() + "\n";
      }
    }
    return result;
  }

  /**
   * Generates indentation for a task.
   * @param task - The task to generate indentation for.
   * @returns A string representing the indentation.
   */
  static indent = function (task: Task): string {
    return "  | ".repeat(task.indent);
  };

  /**
   * Indentation level.
   */
  indent: number;
  /**
   * Whether the task is disabled.
   */
  disabled: boolean;
  /**
   * The current state of the task.
   */
  state: TaskState;
  /**
   * The state to set when the task is disposed.
   */
  disposeState: TaskStateEnd;
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
    this.disposeState = options.disposeState ?? "completed";
    this.indent = Math.max(options.indent ?? 0);
    taskList.push(this);
    // deno-coverage-ignore
    if (isInteractive()) renderer();
  }

  /**
   * Formats the task for logging.
   * @returns A formatted string.
   */
  sprint(): string {
    if (this.disabled) return "";
    return Task.indent(this) + sprintTask(this.prefix, this.text)[this.state];
  }

  /**
   * Sets the task state to "started".
   * @return The task instance for chaining.
   */
  start(): Task {
    this.state = "started";
    if (this.disabled) return this;
    if (!isInteractive()) {
      process.stdout.write(this.sprint() + "\n");
    }
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
    if (this.disabled) return this;
    if (!isInteractive()) {
      process.stdout.write(this.sprint() + "\n");
    }
    return this;
  }

  /**
   * Runs the task with a given runner function.
   * Refreshing will be continued until all tasks are in an end state.
   * @param runner - A function that returns an end state.
   * @returns The task instance for chaining.
   */
  startRunner(runner: TaskRunner<TaskRunnerReturn>): Task;
  startRunner(runner: Promise<TaskRunnerReturn>): Promise<Task>;
  startRunner(runner: TaskRunner<Promise<TaskRunnerReturn>>): Promise<Task>;
  startRunner(runner: AnyRunner): Promise<Task> | Task {
    return startRunner(this, runner as any);
  }

  [Symbol.dispose]() {
    if (this.state === "started" || this.state === "idle") {
      this.end(this.disposeState);
    }
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
    this.prefix = options.prefix;
    this.disabled = options.disabled ?? false;
  }

  /**
   * Prints a message to the console without a new line when there are no ongoing tasks.
   * @param message - The message to print.
   * @returns A promise that resolves when the message has been printed.
   */
  async print(message: string): Promise<void> {
    if (this.disabled) return;
    if (!isInteractive()) {
      process.stdout.write(message);
      return;
      // deno-coverage-ignore-start
    }
    await mutex.acquire();
    process.stdout.write(message);
    mutex.release();
  }
  // deno-coverage-ignore-stop

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
