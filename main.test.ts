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
import { format, Logger, Task, type TaskStateEnd } from "./main.ts";
import { assertEquals } from "jsr:@std/assert";
import process from "node:process";
import { stripVTControlCharacters } from "node:util";
import { list, mutex, state } from "./render.ts";

state.noLoop = true;

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
    await mutex.acquire();
    try {
      for (const [i, line] of lineList.entries()) {
        assertEquals(output[i], line);
      }
    } finally {
      process.stdout.write = originalWrite;
      mutex.release();
    }
  };
}

Deno.test("Logger.sprintLevel with no level returns uncolored prefix", () => {
  const logger = new Logger({ prefix: "TestApp" });
  const result = logger.sprintLevel("plain");
  assertEquals(result, "TestApp plain");
});

Deno.test("Logger.sprintTask", () => {
  const logger = new Logger({ prefix: "TestApp" });
  const result = logger.sprintTask(format(undefined, "plain"));
  assertEquals(
    result.started,
    magenta("- TestApp") + " " + brightBlack("undefined") + " " +
      green("'plain'") + " ...",
  );
  assertEquals(
    result.skipped,
    gray("✓ TestApp") + " " + brightBlack("undefined") + " " +
      green("'plain'") + " ... " + gray("skipped"),
  );
  assertEquals(
    result.completed,
    green("✓ TestApp") + " " + brightBlack("undefined") + " " +
      green("'plain'") + " ... " + bold(green("done")),
  );
});

Deno.test(
  "Logger.disabled disables logging",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp", disabled: true });
      await logger.print("print");
      await logger.println("println");
      await logger.info("info");
      await logger.warn("warn");
      await logger.error("error");
      await logger.success("success");
    },
  ),
);

Deno.test("Logger.disabled keeps sprintLevel", () => {
  const logger = new Logger({ prefix: "TestApp", disabled: true });
  const result = logger.sprintLevel("plain");
  assertEquals(result, "TestApp plain");
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
    `${blue("ℹ TestApp")} This is an informational message.\n`,
  ),
);

Deno.test(
  "Logger.warn logs warning messages",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp" });
      await logger.warn("This is a warning.");
    },
    `${yellow("⚠ TestApp")} This is a warning.\n`,
  ),
);

Deno.test(
  "Logger.error logs error messages",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp" });
      await logger.error("This is an error.");
    },
    `${red("✗ TestApp")} This is an error.\n`,
  ),
);

Deno.test(
  "Logger.error logs error messages",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp" });
      await logger.error("This is an error.");
    },
    `${red("✗ TestApp")} This is an error.\n`,
  ),
);

Deno.test(
  "Logger.success logs success messages",
  expectOutput(
    async () => {
      const logger = new Logger({ prefix: "TestApp" });
      await logger.success("This is a success message.");
    },
    `${green("✓ TestApp")} This is a success message.\n`,
  ),
);

Deno.test("Logger.start is completed", async () => {
  const logger = new Logger({ prefix: "TestApp" });
  const task = logger.task({ text: "Operating" }).end("completed");
  await mutex.acquire();
  assertEquals(task.state, "completed");
  mutex.release();
});

Deno.test("task.sprint", () => {
  list.length = 0;
  const logger = new Logger({ prefix: "TestApp" });
  const task = logger.task({ text: "Operating" }).start();
  assertEquals(
    task.sprint(),
    magenta("- TestApp") + " Operating ...",
  );
  task.disabled = true;
  assertEquals(task.sprint(), "");
});

Deno.test("Task.sprintList", async () => {
  list.length = 0;
  const logger = new Logger({ prefix: "TestApp" });
  const task0 = logger.task({ text: "0" }).start();
  assertEquals(list[0], task0);
  assertEquals(
    Task.sprintList(),
    magenta("- TestApp") + " 0 ...\n",
  );
  logger.task({ text: "1" }).start();
  logger.task({ text: "2" }).start();
  assertEquals(
    Task.sprintList(),
    magenta("- TestApp") + " 0 ...\n" +
      magenta("- TestApp") + " 1 ...\n" +
      magenta("- TestApp") + " 2 ...\n",
  );
});

Deno.test("Task.sprintList empty", () => {
  list.length = 0;
  assertEquals(Task.sprintList(), "");
});

Deno.test("task.startRunner", async () => {
  const logger = new Logger({ prefix: "TestApp" });

  let task: Task = logger.task({ text: "0" }).startRunner(({ task }) => {
    assertEquals(task.state, "started");
    return "completed";
  });
  assertEquals(task.state, "completed");

  let asyncTask: Promise<Task> = logger.task({ text: "1" }).startRunner(
    async ({ task }): Promise<TaskStateEnd> => {
      assertEquals(task.state, "started");
      return "aborted";
    },
  );
  assertEquals((await asyncTask).state, "aborted");

  asyncTask = logger.task({ text: "1" }).startRunner(
    Promise.resolve<TaskStateEnd>("failed"),
  );
  assertEquals((await asyncTask).state, "failed");

  task = logger.task({ text: "state from throw" }).startRunner(() => {
    throw "aborted";
  });
  assertEquals(task.state, "aborted");

  task = logger.task({ text: "catch error" }).startRunner(() => {
    throw new Error();
  });
  assertEquals(task.state, "failed");

  asyncTask = logger.task({ text: "catch error" }).startRunner(async () => {
    throw new Error("aborted");
  });
  assertEquals((await asyncTask).state, "failed");
});

Deno.test("task[Symbol.dispose]", () => {
  const logger = new Logger({ prefix: "TestApp" });

  const task = logger.task({ text: "0", disposeState: "failed" });
  {
    using op = task;
    assertEquals(op.state, "idle");
    op.start();
    assertEquals(op.state, "started");
  }
  assertEquals(task.state, "failed");

  {
    using op = task;
    op.state = "completed";
  }
  assertEquals(task.state, "completed");
});
