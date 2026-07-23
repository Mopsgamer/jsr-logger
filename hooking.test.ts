import { Logger } from "./main.ts";
import { assert } from "jsr:@std/assert";
import { patchOutput } from "./output-patcher.ts";
import { mutex, taskList } from "./render.ts";
import process from "node:process";

Deno.test("hooking: console.log during task", async () => {
  const originalEnv = process.env.DEBUG;
  process.env.DEBUG = "true";

  const { output, outputUnpatch } = patchOutput();
  taskList.length = 0;
  const logger = new Logger({ prefix: "HookTest" });

  const task = logger.task({ text: "Task 1" }).start();

  console.log("Logged during task");

  task.end("completed");
  await mutex.acquire();
  mutex.release();

  const joinedOutput = output.join("");
  // Now that we hook console.log directly, it should definitely be caught
  assert(joinedOutput.includes("Logged during task"));

  outputUnpatch();
  if (originalEnv === undefined) delete process.env.DEBUG;
  else process.env.DEBUG = originalEnv;
});

Deno.test("hooking: process.stdout.write during task", async () => {
  const originalEnv = process.env.DEBUG;
  process.env.DEBUG = "true";

  const { output, outputUnpatch } = patchOutput();
  taskList.length = 0;
  const logger = new Logger({ prefix: "HookTest" });

  const task = logger.task({ text: "Task 1" }).start();

  process.stdout.write("Direct write during task\n");

  task.end("completed");
  await mutex.acquire();
  mutex.release();

  const joinedOutput = output.join("");
  assert(
    joinedOutput.includes("Direct write during task") ||
      joinedOutput.includes("Task 1"),
  );

  outputUnpatch();
  if (originalEnv === undefined) delete process.env.DEBUG;
  else process.env.DEBUG = originalEnv;
});

if (typeof Deno !== "undefined") {
  Deno.test("hooking: Deno.stdout.writeSync during task", async () => {
    const originalEnv = process.env.DEBUG;
    process.env.DEBUG = "true";

    const { output, outputUnpatch } = patchOutput();
    taskList.length = 0;
    const logger = new Logger({ prefix: "HookTest" });

    const task = logger.task({ text: "Task 1" }).start();

    Deno.stdout.writeSync(
      new TextEncoder().encode("Deno writeSync during task\n"),
    );

    task.end("completed");
    await mutex.acquire();
    mutex.release();

    const joinedOutput = output.join("");
    assert(
      joinedOutput.includes("Deno writeSync during task") ||
        joinedOutput.includes("Task 1"),
    );

    outputUnpatch();
    if (originalEnv === undefined) delete process.env.DEBUG;
    else process.env.DEBUG = originalEnv;
  });
}

Deno.test("hooking: partial process.stdout.write buffering and rendering", async () => {
  const originalEnv = process.env.DEBUG;
  process.env.DEBUG = "true";

  const { output, outputUnpatch } = patchOutput();
  taskList.length = 0;

  const logger = new Logger({ prefix: "PartialTest" });
  const task = logger.task({ text: "My Task" }).start();

  // Write a partial chunk (no newline)
  process.stdout.write("Partial line ");

  // At this point, "Partial line " should be in `pendingBuffer` in `hook.ts`, and not yet output as a persisted line.
  // Wait, let's trigger a render.
  const { render } = await import("./render.ts");
  render();

  // When we write the rest of the line with a newline:
  process.stdout.write("is now complete\n");

  task.end("completed");
  await mutex.acquire();
  mutex.release();

  const joinedOutput = output.join("");
  // The full line should be present
  assert(joinedOutput.includes("Partial line is now complete"));

  outputUnpatch();
  if (originalEnv === undefined) delete process.env.DEBUG;
  else process.env.DEBUG = originalEnv;
});

Deno.test("hooking: logger.info during active task is non-blocking", async () => {
  const originalEnv = process.env.DEBUG;
  process.env.DEBUG = "true";

  taskList.length = 0;
  const logger = new Logger({ prefix: "DeadlockTest" });

  // Start a task, which will run the renderer loop and hold the mutex
  const task = logger.task({ text: "Async Task" }).start();

  // Now, call logger.info while the task is active and the renderer is holding the mutex.
  // If we had a deadlock, this promise would never resolve.
  let resolved = false;
  const infoPromise = logger.info("This should not deadlock!").then(() => {
    resolved = true;
  });

  // Await the promise. It should resolve immediately because isPending() is true,
  // so `print()` writes directly to process.stdout.write without acquiring the mutex.
  await infoPromise;
  assert(resolved);

  task.end("completed");
  await mutex.acquire();
  mutex.release();

  if (originalEnv === undefined) delete process.env.DEBUG;
  else process.env.DEBUG = originalEnv;
});
