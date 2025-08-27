import {
  blue,
  bold,
  brightBlack,
  gray,
  green,
  magenta,
  red,
  yellow,
} from "@std/fmt/colors";
import { format, Logger } from "./main.ts";
import { assertEquals } from "@std/assert";
import process from "node:process";
import { stripVTControlCharacters } from "node:util";

function expectOutput(
  startup: () => void,
  ...lineList: (string | undefined)[]
) {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (data: string): boolean => {
    output.push(data);
    return true;
  };

  try {
    startup();
    for (const [i, line] of lineList.entries()) {
      assertEquals(output[i], line);
    }
  } finally {
    process.stdout.write = originalWrite;
  }
}

Deno.test("Logger.sprintLevel with no level returns uncolored prefix", () => {
  const logger = new Logger({ prefix: "TestApp" });
  const result = logger.sprintLevel("plain");
  assertEquals(result, "[TestApp] plain");
});

Deno.test("Logger.sprintTask", () => {
  const logger = new Logger({ prefix: "TestApp" });
  const result = logger.sprintTask("plain");
  assertEquals(
    result.started,
    magenta("- [TestApp]") + " " + brightBlack("undefined") + " " +
      green("'plain'") + " ...",
  );
  assertEquals(
    result.skipped,
    gray("✓ [TestApp]") + " " + brightBlack("undefined") + " " +
      green("'plain'") + " ... " + gray("skipped"),
  );
  assertEquals(
    result.completed,
    green("✓ [TestApp]") + " " + brightBlack("undefined") + " " +
      green("'plain'") + " ... " + bold(green("done")),
  );
});

Deno.test("Logger.disabled disables logging", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp", disabled: true });
      logger.info("info");
    },
  );
});

Deno.test("Logger.disabled keeps sprintLevel", () => {
  const logger = new Logger({ prefix: "TestApp", disabled: true });
  const result = logger.sprintLevel("plain");
  assertEquals(result, "[TestApp] plain");
});

Deno.test("format logs string arg right", () => {
  const logger = new Logger({ prefix: "TestApp" });
  assertEquals(format("a.b."), `a.b.`);
});

Deno.test("format logs boolean arg right", () => {
  const logger = new Logger({ prefix: "TestApp" });
  assertEquals(stripVTControlCharacters(format(true)), `true`);
});

Deno.test("format logs object arg right", () => {
  const logger = new Logger({ prefix: "TestApp" });
  assertEquals(format({}), `{}`);
});

Deno.test("format logs array arg right", () => {
  const logger = new Logger({ prefix: "TestApp" });
  assertEquals(stripVTControlCharacters(format([])), `[ [length]: 0 ]`);
});

Deno.test("Logger.info logs informational messages", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      logger.info("This is an informational message.");
    },
    `${blue("ℹ [TestApp]")} This is an informational message.\n`,
  );
});

Deno.test("Logger.warn logs warning messages", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      logger.warn("This is a warning.");
    },
    `${yellow("⚠ [TestApp]")} This is a warning.\n`,
  );
});

Deno.test("Logger.error logs error messages", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      logger.error("This is an error.");
    },
    `${red("✗ [TestApp]")} This is an error.\n`,
  );
});

Deno.test("Logger.error logs error messages", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      logger.task({ text: "Never" });
      logger.error("This is an error.");
    },
    `${magenta("- [TestApp]")} Never ...\x1B[?25l`,
    `\r${red("✗ [TestApp]")} Never ... ${bold(red("failed"))}\x1B[?25h\n`,
    `${red("✗ [TestApp]")} This is an error.\n`,
  );
});

Deno.test("Logger.success logs success messages", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      logger.success("This is a success message.");
    },
    `${green("✓ [TestApp]")} This is a success message.\n`,
  );
});

Deno.test("Logger.end should be ignored if not started", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      logger.task({ text: "test" }).end("completed");
    },
  );
});

Deno.test("Logger.start is completed", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      const task = logger.task({ text: "Operating" }).end("completed");
      assertEquals(task.state, "completed");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\x1B[?25h\n`,
  );
});

Deno.test("Logger.start is failed", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      const task = logger.task({ text: "Operating" }).end("failed");
      assertEquals(task.state, "failed");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${red("✗ [TestApp]")} Operating ... ${bold(red("failed"))}\x1B[?25h\n`,
  );
});

Deno.test("Logger.start is aborted", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      const task = logger.task({ text: "Operating" }).end("aborted");
      assertEquals(task.state, "aborted");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${yellow("⚠ [TestApp]")} Operating ... ${
      bold(yellow("aborted"))
    }\x1B[?25h\n`,
  );
});

Deno.test("Logger.start is skipped", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      const task = logger.task({ text: "Operating" }).end("skipped");
      assertEquals(task.state, "skipped");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${gray("✓ [TestApp]")} Operating ... ${gray("skipped")}\x1B[?25h\n`,
  );
});

Deno.test("Logger.start is completed with Logger.success", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      const task = logger.task({ text: "Operating" }).start();
      logger.success("Succ");
      assertEquals(task.state, "completed");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\x1B[?25h\n`,
  );
});

Deno.test("Logger.start is completed with Logger.info", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      const task = logger.task({ text: "Operating" }).start();
      logger.info("test");
      assertEquals(task.state, "completed");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\x1B[?25h\n`,
    `${blue("ℹ [TestApp]")} test\n`,
  );
});

Deno.test("Logger second start ends previous if not ended", () => {
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp" });
      const task = logger.task({ text: "Operating 1" });
      task.text = "Operating 2";
      task.text = "Operating 3";
      task.end("completed");
    },
    `${magenta("- [TestApp]")} Operating 1 ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating 1 ... ${
      bold(green("done"))
    }\x1B[?25h\n`,
    `${magenta("- [TestApp]")} Operating 2 ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating 2 ... ${
      bold(green("done"))
    }\x1B[?25h\n`,
    `${magenta("- [TestApp]")} Operating 3 ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating 3 ... ${
      bold(green("done"))
    }\x1B[?25h\n`,
  );
});
