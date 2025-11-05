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
import { Logger } from "./main.ts";
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
  using logger = new Logger("TestApp");
  const result = logger.sprintLevel(undefined, "plain");
  assertEquals(result, "[TestApp] plain");
});

Deno.test("Logger.sprintStart", () => {
  using logger = new Logger("TestApp");
  const result = logger.sprintTask(undefined, "plain");
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
      using logger = new Logger("TestApp", true);
      logger.info("info");
    },
  );
});

Deno.test("Logger.disabled keeps sprintLevel", () => {
  using logger = new Logger("TestApp", true);
  const result = logger.sprintLevel(undefined, "plain");
  assertEquals(result, "[TestApp] plain");
});

Deno.test("Logger.format logs string arg right", () => {
  using logger = new Logger("TestApp");
  assertEquals(logger.format("a.b."), `a.b.`);
});

Deno.test("Logger.format logs boolean arg right", () => {
  using logger = new Logger("TestApp");
  assertEquals(stripVTControlCharacters(logger.format(true)), `true`);
});

Deno.test("Logger.format logs object arg right", () => {
  using logger = new Logger("TestApp");
  assertEquals(logger.format({}), `{}`);
});

Deno.test("Logger.format logs array arg right", () => {
  using logger = new Logger("TestApp");
  assertEquals(stripVTControlCharacters(logger.format([])), `[ [length]: 0 ]`);
});

Deno.test("Logger.info logs informational messages", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.info("This is an informational message.");
    },
    `${blue("🛈 [TestApp]")} This is an informational message.\n`,
  );
});

Deno.test("Logger.warn logs warning messages", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.warn("This is a warning.");
    },
    `${yellow("⚠ [TestApp]")} This is a warning.\n`,
  );
});

Deno.test("Logger.error logs error messages", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.error("This is an error.");
    },
    `${red("✗ [TestApp]")} This is an error.\n`,
  );
});

Deno.test("Logger.error logs error messages", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Never");
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
      using logger = new Logger("TestApp");
      logger.success("This is a success message.");
    },
    `${green("✓ [TestApp]")} This is a success message.\n`,
  );
});

Deno.test("Logger.end should be ignored if not started", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.end();
    },
    undefined,
  );
});

Deno.test("Logger.printf logs formatted args", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.printf("Good %s.", "grief");
    },
    `Good grief.`,
  );
});

Deno.test("Logger.printfln logs with a new line", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.printfln("Good %s.", "grief");
    },
    `Good grief.\n`,
  );
});

Deno.test("Logger.start is completed", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating");
      logger.end("completed");
      assertEquals(logger.state, "completed");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\x1B[?25h\n`,
  );
});

Deno.test("Logger.start is failed", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating");
      logger.end("failed");
      assertEquals(logger.state, "failed");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${red("✗ [TestApp]")} Operating ... ${bold(red("failed"))}\x1B[?25h\n`,
  );
});

Deno.test("Logger.start is aborted", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating");
      logger.end("aborted");
      assertEquals(logger.state, "aborted");
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
      using logger = new Logger("TestApp");
      logger.start("Operating");
      logger.end("skipped");
      assertEquals(logger.state, "skipped");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${gray("✓ [TestApp]")} Operating ... ${gray("skipped")}\x1B[?25h\n`,
  );
});

Deno.test("Logger.start is completed with Logger.success", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating");
      logger.success("Succ");
      assertEquals(logger.state, "completed");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\x1B[?25h\n`,
  );
});

Deno.test("Logger.start is completed with Logger.info", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating");
      logger.info("test");
      assertEquals(logger.state, "completed");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\x1B[?25h\n`,
    `${blue("🛈 [TestApp]")} test\n`,
  );
});

Deno.test("Logger second start ends previous if not ended", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating 1");
      logger.start("Operating 2");
      logger.start("Operating 3");
      logger.end();
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

Deno.test("Logger dispose works", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating");
      {
        using operation = logger;
      }
      assertEquals(logger.state, "completed");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\x1B[?25h\n`,
  );
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating");
      using operation = logger;
      assertEquals(logger.state, "started");
    },
    `${magenta("- [TestApp]")} Operating ...\x1B[?25l`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\x1B[?25h\n`,
  );
});
