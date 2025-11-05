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
import { format, Logger, Task } from "./main.ts";
import { assertEquals } from "jsr:@std/assert";
import process from "node:process";
import { stripVTControlCharacters } from "node:util";

function expectOutput(
  startup: () => void | Promise<void>,
  ...lineList: (string | undefined)[]
): () => Promise<void> {
  return async () => {
    const output: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = (data: string): boolean => {
      output.push(data);
      return true;
    };

    await startup();
    await Task.mutex.acquire();
    try {
      for (const [i, line] of lineList.entries()) {
        assertEquals(output[i], line);
      }
    } finally {
      process.stdout.write = originalWrite;
      Task.mutex.release();
    }
  };
}

Deno.test("Logger.sprintLevel with no level returns uncolored prefix", () => {
  const logger = new Logger({ prefix: "TestApp" });
  const result = logger.sprintLevel("plain");
  assertEquals(result, "[TestApp] plain");
});

Deno.test("Logger.sprintTask", () => {
  const logger = new Logger({ prefix: "TestApp" });
  const result = logger.sprintTask(format(undefined, "plain"));
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

Deno.test(
  "Logger.disabled disables logging",
  expectOutput(
    () => {
      const logger = new Logger({ prefix: "TestApp", disabled: true });
      logger.info("info");
    },
  ),
);

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

Deno.test(
  "Logger.info logs informational messages",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp" });
      await logger.info("This is an informational message.");
    },
    `${blue("ℹ [TestApp]")} This is an informational message.\n`,
  ),
);

Deno.test(
  "Logger.warn logs warning messages",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp" });
      await logger.warn("This is a warning.");
    },
    `${yellow("⚠ [TestApp]")} This is a warning.\n`,
  ),
);

Deno.test(
  "Logger.error logs error messages",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp" });
      await logger.error("This is an error.");
    },
    `${red("✗ [TestApp]")} This is an error.\n`,
  ),
);

Deno.test(
  "Logger.error logs error messages",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp" });
      await logger.error("This is an error.");
    },
    `${red("✗ [TestApp]")} This is an error.\n`,
  ),
);

Deno.test(
  "Logger.success logs success messages",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp" });
      await logger.success("This is a success message.");
    },
    `${green("✓ [TestApp]")} This is a success message.\n`,
  ),
);

Deno.test("Logger.start is completed", async () => {
  const logger = new Logger({ prefix: "TestApp" });
  const task = logger.task({ text: "Operating" }).end("completed");
  await Task.mutex.acquire()
  assertEquals(task.state, "completed");
  Task.mutex.release()
});
