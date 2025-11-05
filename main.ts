import {
  blue,
  bold,
  getColorEnabled,
  green,
  magenta,
  red,
  yellow,
} from "@std/fmt/colors";
import process from "node:process";
import { formatWithOptions } from "node:util";

/**
 * Enum representing the starting states of the logger.
 */
export type LoggerStateStart = "started" | "idle";

/**
 * Enum representing the end states of the logger.
 */
export type LoggerStateEnd = "completed" | "aborted" | "failed";

/**
 * Enum representing the possible states of the logger.
 */
export type LoggerState = LoggerStateStart | LoggerStateEnd;

/**
 * Logger class for formatted console output.
 */
export class Logger {
  /**
   * A string to prefix all log messages. Wrapped in square brackets.
   */
  private prefix: string;
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
   * The arguments passed to the start method.
   */
  private startedArgs: unknown[] = [];

  /**
   * Creates a new Logger instance.
   * @param prefix - A string to prefix all log messages.
   */
  constructor(prefix: string) {
    this.prefix = `[${prefix}]`;
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
    if (this.#state === "started") {
      this.end("completed");
    }

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
    process.stdout.write(message);
  }

  /**
   * Same as {@link printf}, but adds new line.
   * @param args - The message and optional arguments to log.
   */
  printfln(...args: unknown[]): void {
    const message = this.format(...args);
    process.stdout.write(message + "\n");
  }

  /**
   * Logs an informational message.
   * @param args - The message and optional arguments to log.
   */
  info(...args: unknown[]): void {
    const prefix = blue("ⓘ " + this.prefix);
    this.println(`${prefix} ${this.format(...args)}`);
  }

  /**
   * Logs an error message. Ends any ongoing continuous log as a failure.
   * @param args - The message and optional arguments to log.
   */
  error(...args: unknown[]): void {
    if (this.#state === "started") {
      this.end("failed");
    }

    const prefix = red("✖ " + this.prefix);
    this.println(`${prefix} ${this.format(...args)}`);
  }

  /**
   * Logs a warning message.
   * @param args - The message and optional arguments to log.
   */
  warn(...args: unknown[]): void {
    const prefix = yellow("⚠ " + this.prefix);
    this.println(`${prefix} ${this.format(...args)}`);
  }

  /**
   * Logs a success message.
   * @param args - The message and optional arguments to log.
   */
  success(...args: unknown[]): void {
    if (this.#state === "started") {
      this.end("completed");
    }

    const prefix = green("✔ " + this.prefix);
    this.println(`${prefix} ${this.format(...args)}`);
  }

  /**
   * Starts a continuous log, printing a message with an ellipsis.
   * Can be ended by the `end` and other log-methods such as `info` and `error`.
   * @param args - The message and optional arguments to log.
   */
  start(...args: unknown[]): void {
    this.startedArgs = args;
    const prefix = magenta("- " + this.prefix);
    this.print(`${prefix} ${this.format(...args)}...`);
    this.#state = "started";
  }

  /**
   * Ends any ongoing continuous log, marking it as completed, aborted, or failed.
   * Ignored if the `start` method was not called.
   * @param stateEnd - The end state of the continuous log. Defaults to "completed".
   */
  end(stateEnd?: LoggerStateEnd): void {
    if (this.#state !== "started") return;
    stateEnd ??= "completed";
    this.#state = stateEnd;

    let message: string;
    let color: (message: string) => string;
    switch (stateEnd) {
      case "failed":
        message = "failed";
        color = red;
        break;
      case "aborted":
        message = "aborted";
        color = yellow;
        break;
      default:
        message = "done";
        color = green;
        break;
    }

    const prefix = color("- " + this.prefix);
    const text = this.format(...this.startedArgs);
    const result = bold(color(message));
    this.printfln(`\r${prefix} ${text}...${result}`);
  }

  [Symbol.dispose]() {
    this.end();
  }
}
