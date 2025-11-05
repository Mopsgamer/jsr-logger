# @m234/logger

[![JSR](https://jsr.io/badges/@m234/logger)](https://jsr.io/@m234/logger)
![Tests](https://raw.githubusercontent.com/Mopsgamer/jsr-logger/refs/heads/main/assets/badge-tests.svg)
![Tests coverage](https://raw.githubusercontent.com/Mopsgamer/jsr-logger/refs/heads/main/assets/badge-cov.svg)

A colorful logger with the ability to log "Processing ... done".

<img src="https://raw.githubusercontent.com/Mopsgamer/jsr-logger/refs/heads/main/assets/preview.png" height="140">

## Usage

### Simple printing

Basic logging and formatted output for your application:

```ts
import { format, Logger } from "@m234/logger";

const logger = new Logger({ prefix: "MyApp" });

logger.print("Hello, World!");
logger.println("Hello, World!");
logger.print(format("Hello, World! %o", true));

logger.info("This is an informational message.");
logger.warn("This is a warning.");
logger.error("This is an error.");
logger.success("This is a success message.");
```

### Task printing

Track the progress and result of long-running or multi-step operations. Task
printing provides visual feedback for ongoing, successful, skipped, failed, or
aborted tasks:

```ts
import { Logger } from "@m234/logger";

const logger = new Logger({ prefix: "MyApp" });
using task = logger.task({
  text: "Operating",
  disposeState: "completed",
}).start();

// Output: - MyApp Operating ...
task.end("completed");
// Output: ✓ MyApp Operating ... done
task.end("skipped");
// Output: ✓ MyApp Operating ... skipped
task.end("failed");
// Output: ✗ MyApp Operating ... failed
task.end("aborted");
// Output: ⚠ MyApp Operating ... aborted
```

### Task runner

Automate task execution and handle asynchronous operations with task runners.
This feature allows you to run a function as a task, automatically updating the
task status based on the function's result:

```ts
import { Logger } from "@m234/logger";
import { delay } from "@std/async/delay";

const logger = new Logger({ prefix: "MyApp" });
logger.task({
  text: "Operating",
}).startRunner(async ({ task }) => {
  await delay(1000);
  return "completed";
});
```
