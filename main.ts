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
import { createInterface } from "node:readline/promises";
import isInteractive from "is-interactive";

const readline = createInterface(process.stdin, process.stdout, undefined, isInteractive())

/**
 * Enum representing the starting states of the logger.
 */
export type LoggerStateStart = "started" | "idle";

/**
 * Enum representing the end states of the logger.
 */
export type LoggerStateEnd = "completed" | "aborted" | "failed" | "skipped";

/**
 * Enum representing the possible states of the logger.
 */
export type LoggerState = LoggerStateStart | LoggerStateEnd;

/**
 * Logger levels for formatted console output.
 */
export type LoggerLevel = "info" | "warn" | "error" | "success";

export type Task = {
  
}

/**
 * Type representing the task sprint messages for the logger.
 */
export type TaskSprint = {
  [key in "started" | LoggerStateEnd]: string;
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
   * The current state of the continuous log.
   */
  #state: LoggerState = "idle";

  /**
   * Gets the current state of the logger.
   * @returns The current state of the logger.
   */
  get state(): LoggerState {
    return this.#state;
  }

  /**
   * The prepared strings for the continuous log.
   */
  private taskSprint: TaskSprint = undefined as any;

  /**
   * Creates a new Logger instance.
   * @param prefix - A string to prefix all log messages.
   * @param disabled - Whether the logger is disabled. Defaults to `false`.
   */
  constructor(prefix: string, disabled = false) {
    this.prefix = `[${prefix}]`;
    this.disabled = disabled;
  }

  /**
   * Formats the given arguments into a string.
   * @param args - The arguments to format.
   * @returns A formatted string.
   */
  format(...args: unknown[]): string {
    const colors = getColorEnabled();
    const [message, ...other] = args;
    if (typeof message == "string") {
      return formatWithOptions({ colors }, message, ...other);
    }

    return args.map((a) => formatWithOptions({ colors }, "%o", a)).join(" ");
  }

  /**
   * Prints a message to the console without a new line. Ends any ongoing continuous log as a success.
   * @param message - The message to print.
   */
  print(message: string): void {
    if (this.#state === "started") this.end("completed");

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
    const message = this.format(...args);
    this.print(message);
  }

  /**
   * Same as {@link printf}, but adds new line.
   * @param args - The message and optional arguments to log.
   */
  printfln(...args: unknown[]): void {
    const message = this.format(...args);
    this.print(message + "\n");
  }

  /**
   * Returns a formatted message string for a given level (no side effects).
   * @param level - The log level: 'info', 'warn', 'error', 'success', or undefined/null for no level.
   * @param args - The message and optional arguments to log.
   */
  sprintLevel(
    level?: LoggerLevel,
    ...args: unknown[]
  ): string {
    let prefix: string;
    switch (level) {
      case "info":
        prefix = blue("ℹ " + this.prefix);
        break;
      case "warn":
        prefix = yellow("⚠ " + this.prefix);
        break;
      case "error":
        prefix = red("✗ " + this.prefix);
        break;
      case "success":
        prefix = green("✓ " + this.prefix);
        break;
      default:
        prefix = this.prefix;
        break;
    }
    return `${prefix} ${this.format(...args)}`;
  }

  /**
   * Returns a formatted message string for the end of a continuous log.
   */
  sprintTask(...args: unknown[]): TaskSprint {
    const title = this.format(...args);
    const left = ` ${title} ...`;
    const taskSprint: TaskSprint = {
      started: magenta("- " + this.prefix) + left,
      aborted: this.sprintLevel("warn", title) + " ... " +
        bold(yellow("aborted")),
      completed: this.sprintLevel("success", title) + " ... " +
        bold(green("done")),
      failed: this.sprintLevel("error", title) + " ... " + bold(red("failed")),
      skipped: gray("✓ " + this.prefix) + " " + title + " ... " +
        gray("skipped"),
    };
    return taskSprint;
  }

  /**
   * Logs an informational message.
   * @param args - The message and optional arguments to log.
   */
  info(...args: unknown[]): void {
    this.println(this.sprintLevel("info", ...args));
  }

  /**
   * Logs an error message. Ends any ongoing continuous log as a failure.
   * @param args - The message and optional arguments to log.
   */
  error(...args: unknown[]): void {
    if (this.#state === "started") this.end("failed");

    this.println(this.sprintLevel("error", ...args));
  }

  /**
   * Logs a warning message.
   * @param args - The message and optional arguments to log.
   */
  warn(...args: unknown[]): void {
    this.println(this.sprintLevel("warn", ...args));
  }

  /**
   * Logs a success message.
   * @param args - The message and optional arguments to log.
   */
  success(...args: unknown[]): void {
    if (this.#state === "started") this.end("completed");

    this.println(this.sprintLevel("success", ...args));
  }

  /**
   * Starts a continuous log, printing a message with an ellipsis.
   * Can be ended by the `end` and other log-methods such as `info` and `error`.
   * @param args - The message and optional arguments to log.
   */
  start(...args: unknown[]): void {
    if (this.#state === "started") this.end();
    this.taskSprint = this.sprintTask(...args);
    this.print(this.taskSprint.started + "\x1B[?25l");
    this.#state = "started";
  }

  /**
   * Ends any ongoing continuous log.
   * Ignored if the `start` method was not called.
   * @param stateEnd - The end state of the continuous log. Defaults to "completed".
   */
  end(stateEnd: LoggerStateEnd = "completed"): void {
    if (this.#state !== "started") return;
    this.#state = stateEnd;
    this.printfln("\r" + this.taskSprint[stateEnd] + "\x1B[?25h");
  }

  [Symbol.dispose]() {
    this.end();
  }
}
