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
import { stripVTControlCharacters } from "node:util";
import { list, mutex, state } from "./render.ts";
import { patchOutput } from "./output-patcher.test.ts";

state.noLoop = true;

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

Deno.test("Logger.disabled disables logging", async () => {
  const { output, outputUnpatch } = patchOutput();
  const logger = new Logger({ prefix: "TestApp", disabled: true });
  await logger.print("print");
  await logger.println("println");
  await logger.info("info");
  await logger.warn("warn");
  await logger.error("error");
  await logger.success("success");
  assertEquals(output.length, 0);
  outputUnpatch();
});

Deno.test("Logger.disabled keeps sprintLevel", () => {
  const logger = new Logger({ prefix: "TestApp", disabled: true });
  const result = logger.sprintLevel("plain");
  assertEquals(result, "TestApp plain");
});

Deno.test("format logs string arg right", () => {
  assertEquals(format("a.b."), `a.b.`);
});

Deno.test("format logs boolean arg right", () => {
  assertEquals(stripVTControlCharacters(format(true)), `true`);
});

Deno.test("format logs object arg right", () => {
  assertEquals(format({}), `{}`);
});

Deno.test("format logs array arg right", () => {
  assertEquals(stripVTControlCharacters(format([])), `[ [length]: 0 ]`);
});

Deno.test("Logger.info logs informational messages", async () => {
  const { output, outputUnpatch } = patchOutput();
  const logger = new Logger({ prefix: "TestApp" });
  await logger.info("This is an informational message.");
  assertEquals(
    output[0],
    `${blue("ℹ TestApp")} This is an informational message.\n`,
  );
  outputUnpatch();
});

Deno.test("Logger.warn logs warning messages", async () => {
  const { output, outputUnpatch } = patchOutput();
  const logger = new Logger({ prefix: "TestApp" });
  await logger.warn("This is a warning.");
  assertEquals(
    output[0],
    `${yellow("⚠ TestApp")} This is a warning.\n`,
  );
});

Deno.test("Logger.error logs error messages", async () => {
  const { output, outputUnpatch } = patchOutput();
  const logger = new Logger({ prefix: "TestApp" });
  await logger.error("This is an error.");
  assertEquals(
    output[0],
    `${red("✗ TestApp")} This is an error.\n`,
  );
  outputUnpatch();
});

Deno.test("Logger.success logs success messages", async () => {
  const { output, outputUnpatch } = patchOutput();
  const logger = new Logger({ prefix: "TestApp" });
  await logger.success("This is a success message.");
  assertEquals(
    output[0],
    `${green("✓ TestApp")} This is a success message.\n`,
  );
});

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

Deno.test("task.startRunner", async (t) => {
  const logger = new Logger({ prefix: "TestApp" });

  let asyncTask: Promise<Task>, task: Task;

  await t.step({
    name: "return/resolve",
    async fn(t) {
      asyncTask = logger.task({ text: "1" }).startRunner(
        Promise.resolve<TaskStateEnd>("failed"),
      );
      assertEquals((await asyncTask).state, "failed");

      task = logger.task({ text: "0" }).startRunner(({ task }) => {
        assertEquals(task.state, "started");
        return "completed";
      });
      assertEquals(task.state, "completed");

      asyncTask = logger.task({ text: "1" }).startRunner(
        async ({ task }): Promise<TaskStateEnd> => {
          assertEquals(task.state, "started");
          return "aborted";
        },
      );
      assertEquals((await asyncTask).state, "aborted");
    },
  });

  await t.step({
    name: "throw/reject",
    async fn() {
      asyncTask = logger.task({
        text: "1",
      })
        .startRunner(
          Promise.reject<TaskStateEnd>("failed"),
        );
      assertEquals((await asyncTask).state, "failed");

      task = logger.task({
        text: "state from throw",
      })
        .startRunner(() => {
          throw "aborted";
        });
      assertEquals(task.state, "aborted");

      task = logger.task({
        text: "catch error",
      })
        .startRunner(() => {
          throw new Error("aborted");
        });
      assertEquals(task.state, "failed");

      asyncTask = logger.task({
        text: "catch error",
      })
        .startRunner(async () => {
          throw new Error("aborted");
        });
      assertEquals((await asyncTask).state, "failed");
    },
  });
});
Deno.test("task.startRunner return/throw undefined", async () => {
  const logger = new Logger({ prefix: "TestApp" });
  let asyncTask = logger.task({
    text: "catch undefined",
    disposeState: "aborted",
  })
    .startRunner(Promise.resolve(undefined));
  assertEquals((await asyncTask).state, "aborted");

  let task = logger.task({
    text: "catch undefined",
    disposeState: "skipped",
  })
    .startRunner(() => {
      return;
    });
  assertEquals(task.state, "skipped");

  task = logger.task({
    text: "catch undefined",
    disposeState: "skipped",
  })
    .startRunner(() => {
      throw undefined;
    });
  assertEquals(task.state, "skipped");

  asyncTask = logger.task({
    text: "catch undefined",
    disposeState: "skipped",
  }).startRunner(async () => {
    throw undefined;
  });
  assertEquals((await asyncTask).state, "skipped");

  asyncTask = logger.task({
    text: "catch undefined",
    disposeState: "skipped",
  }).startRunner(async (): Promise<TaskStateEnd> => {
    return "failed";
  });
  assertEquals((await asyncTask).state, "failed");
});

Deno.test("task[Symbol.dispose]", async (t) => {
  const logger = new Logger({ prefix: "TestApp" });

  await t.step({
    name: "changes state from started",
    fn() {
      const task = logger.task({
        text: "0",
        disposeState: "failed",
      });
      {
        using op = task;
        assertEquals(op.state, "idle");
        op.start();
        assertEquals(op.state, "started");
      }
      assertEquals(task.state, "failed");
    },
  });

  await t.step({
    name: "changes state from idle",
    fn() {
      const task = logger.task({
        text: "0",
        disposeState: "failed",
      });
      {
        using op = task;
        assertEquals(op.state, "idle");
      }
      assertEquals(task.state, "failed");
    },
  });

  await t.step({
    name: "keeps an end state",
    fn() {
      const task = logger.task({
        text: "0",
        disposeState: "failed",
      });
      {
        using op = task;
        op.state = "completed";
      }
      assertEquals(task.state, "completed");
    },
  });
});
