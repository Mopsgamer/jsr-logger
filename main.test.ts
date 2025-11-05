import { blue, bold, green, magenta, red, yellow } from "@std/fmt/colors";
import { Logger } from "./main.ts";
import { assertEquals } from "@std/assert";
import process from "node:process";
import { stripVTControlCharacters } from "node:util";

Deno.test("Logger.sprintLevel with no level returns uncolored prefix", () => {
  using logger = new Logger("TestApp");
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
    `${magenta("- [TestApp]")} Never ...`,
    `\r${red("✗ [TestApp]")} Never ... ${bold(red("failed"))}\n`,
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
    `${magenta("- [TestApp]")} Operating ...`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\n`,
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
    `${magenta("- [TestApp]")} Operating ...`,
    `\r${red("✗ [TestApp]")} Operating ... ${bold(red("failed"))}\n`,
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
    `${magenta("- [TestApp]")} Operating ...`,
    `\r${yellow("⚠ [TestApp]")} Operating ... ${bold(yellow("aborted"))}\n`,
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
    `${magenta("- [TestApp]")} Operating ...`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\n`,
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
    `${magenta("- [TestApp]")} Operating ...`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\n`,
    `${blue("🛈 [TestApp]")} test\n`,
  );
});

Deno.test("Logger.endDisposable should be completed", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating");
      {
        using operation = logger;
      }
      assertEquals(logger.state, "completed");
    },
    `${magenta("- [TestApp]")} Operating ...`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\n`,
  );
});

Deno.test("Logger.endDisposable should be completed after", () => {
  expectOutput(
    () => {
      using logger = new Logger("TestApp");
      logger.start("Operating");
      using operation = logger;
      assertEquals(logger.state, "started");
    },
    `${magenta("- [TestApp]")} Operating ...`,
    `\r${green("✓ [TestApp]")} Operating ... ${bold(green("done"))}\n`,
  );
});
