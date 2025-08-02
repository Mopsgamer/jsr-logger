# @m234/logger

[![JSR](https://jsr.io/badges/@m234/logger)](https://jsr.io/@m234/logger)
![Tests](https://raw.githubusercontent.com/Mopsgamer/jsr-logger/refs/heads/main/assets/badge-tests.svg) ![Tests coverage](https://raw.githubusercontent.com/Mopsgamer/jsr-logger/refs/heads/main/assets/badge-cov.svg)

A colorful logger with the ability to log "Processing ... done".

<img src="https://raw.githubusercontent.com/Mopsgamer/jsr-logger/refs/heads/main/assets/preview.png" height="140">

## Usage

Here is an example of how to use the Logger:

```ts
import { Logger } from "@m234/logger";
import ora from "ora";

using logger = new Logger("MyApp");

logger.print("Hello, World!");
logger.println("Hello, World!");
logger.printf("Hello, World! %o", true);
logger.printfln("Hello, World! %o", true);

// Get string
const text = logger.sprintLevel("info", "This is an informational message.");
ora(text).start();

logger.info("This is an informational message.");
logger.warn("This is a warning.");
logger.error("This is an error.");
logger.success("This is a success message.");
// Note: There are no 'log' (use 'printfln'), 'debug', or 'verbose' methods.

logger.start("Operating");
logger.end(); // Same as logger.end("completed");
// Output: 🛈 [MyApp] Operating ... done
logger.end("skipped");
// Output: ✓ [MyApp] Operating ... skipped
logger.end("failed");
// Output: ✗ [MyApp] Operating ... failed
logger.end("aborted");
// Output: ⚠ [MyApp] Operating ... aborted
```

### Logging with Formatting

You can log messages without a new line or prefix, but with formatting:

```ts
import { Logger } from "@m234/logger";

using logger = new Logger("MyApp");

logger.printf("Starting %s ... ", "machine");
logger.println("done");
// Output: Starting machine ... done
```

### Continuous Logging with `start` and `end`

For more control, use the `start` and `end` methods:

```ts
import { Logger } from "@m234/logger";

using logger = new Logger("MyApp");

logger.start("Operating");
// Output: 🛈 [MyApp] Operating ...
logger.end(); // Clears the line
// Output: ✓ [MyApp] Operating ... done
```

The `error`, `success`, `info`, and `warn` methods can also be used to end a
continuous log. All methods except `error` will mark the log as completed:

```ts
import { Logger } from "@m234/logger";

using logger = new Logger("MyApp");

logger.start("Operating");
// Output: - [MyApp] Operating ...
logger.error("An error occurred");
logger.end("completed"); // Ignored
// Output: ✗ [MyApp] Operating ... failed
// Output: ✗ [MyApp] An error occurred
```

> [!WARNING]
> `logger.end` will **not** be automatically called before `console.log` or
> `stdout/stderr.write`. Please ensure you use `logger.end` or other log methods
> to properly end a continuous log.
