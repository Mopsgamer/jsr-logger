import { sprintf } from "@std/fmt/printf";
import { blue, green, magenta, red, yellow } from "@std/fmt/colors";

/**
 * A Logger class for printing formatted messages to the console with various log levels.
 */
export class Logger {
  private prefix: string;
  #hasSucceeded: boolean = false;

  /**
   * Indicates whether the last operation was successful.
   * @returns `true` if the last operation failed, otherwise `false`.
   */
  get hasSucceeded(): boolean {
    return this.#hasSucceeded;
  }

  #isStarted: boolean = false;

  /**
   * Indicates whether a log operation is currently in progress.
   * @returns `true` if a log operation is ongoing, otherwise `false`.
   */
  get isStarted(): boolean {
    return this.#isStarted;
  }

  private startedArgs: unknown[] = [];

  /**
   * Creates a new Logger instance.
   * @param prefix - A string to prefix all log messages. Defaults to an empty string.
   */
  constructor(prefix: string = "") {
    this.prefix = prefix ? `[${prefix}]` : "";
  }

  /**
   * Formats the given arguments into a string.
   * @param args - The arguments to format.
   * @returns A formatted string.
   */
  format(...args: unknown[]): string {
    const [message, ...other] = args;
    if (typeof message == "string") {
      return sprintf(message, ...other);
    }

    return args.map((a) => sprintf("%v", a)).join(" ");
  }

  /**
   * Prints a message to the console. Ends any ongoing log operation if necessary.
   * @param message - The message to print.
   */
  print(message: string) {
    if (this.isStarted) {
      this.end(true);
    }

    Deno.stdout.write(
      new TextEncoder().encode(message),
    );
  }

  /**
   * Logs an informational message.
   * @param args - The message and optional arguments to log.
   */
  info(...args: unknown[]) {
    this.print(
      `${blue("ⓘ")} ${blue(this.prefix)} ${this.format(...args)}\n`,
    );
  }

  /**
   * Logs an error message. Ends any ongoing log operation as a failure.
   * @param args - The message and optional arguments to log.
   */
  error(...args: unknown[]) {
    if (this.isStarted) {
      this.end(false);
    }

    this.print(`${red("✖")} ${red(this.prefix)} ${this.format(...args)}\n`);
  }

  /**
   * Logs a warning message.
   * @param args - The message and optional arguments to log.
   */
  warn(...args: unknown[]) {
    this.print(
      `${yellow("⚠")} ${yellow(this.prefix)} ${this.format(...args)}\n`,
    );
  }

  /**
   * Logs a success message.
   * @param args - The message and optional arguments to log.
   */
  success(...args: unknown[]) {
    if (this.isStarted) {
      this.end(true);
    }

    this.print(
      `${green("✔")} ${green(this.prefix)} ${this.format(...args)}\n`,
    );
  }

  /**
   * Starts a log operation, printing a message with an ellipsis.
   * @param args - The message and optional arguments to log.
   */
  start(...args: unknown[]) {
    this.startedArgs = args;
    this.print(
      `${magenta("-")} ${magenta(this.prefix)} ${this.format(...args)}...`,
    );
    this.#isStarted = true;
  }

  /**
   * Ends a log operation, marking it as successful or failed.
   * Ignored if already started.
   * @param success - Whether the operation was successful.
   */
  end(success: boolean) {
    if (!this.isStarted) return;
    this.#hasSucceeded = success;
    this.#isStarted = false;
    const color = success ? green : red;
    const message = success ? "done" : "fail";
    this.inline(
      `\r${color("-")} ${color(this.prefix)} ${
        this.format(...this.startedArgs)
      }...${color(message)}\n`,
    );
  }

  /**
   * Logs a message inline without a newline.
   * @param args - The message and optional arguments to log.
   */
  inline(...args: unknown[]) {
    const message = this.format(...args);
    Deno.stdout.write(new TextEncoder().encode(message));
  }
}
