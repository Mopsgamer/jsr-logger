# @m234/logger

[![JSR](https://jsr.io/badges/@m234/logger)](https://jsr.io/@m234/logger)
![Tests](https://raw.githubusercontent.com/Mopsgamer/jsr-logger/refs/heads/main/assets/badge-tests.svg)
![Tests coverage](https://raw.githubusercontent.com/Mopsgamer/jsr-logger/refs/heads/main/assets/badge-cov.svg)

A colorful logger with the ability to log "Processing ... done".

<img src="https://raw.githubusercontent.com/Mopsgamer/jsr-logger/refs/heads/main/assets/preview.png" height="140">

## Usage

Here is an example of how to use the Logger:

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

using task = logger.task({ text: "Operating", disposeState: "completed" });
// Output: - [MyApp] Operating ...
task.end("completed");
// Output: ✓ [MyApp] Operating ... done
task.end("skipped");
// Output: ✓ [MyApp] Operating ... skipped
task.end("failed");
// Output: ✗ [MyApp] Operating ... failed
task.end("aborted");
// Output: ⚠ [MyApp] Operating ... aborted
```
