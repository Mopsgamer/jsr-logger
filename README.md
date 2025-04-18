# @m234/logger

Colorful logger with the ability to log operating...done messages.

## Usage

Here's an example of how to use the Logger:

```ts
import { Logger } from "@m234/logger";

const logger = new Logger("MyApp");

logger.info("This is an informational message.");
logger.warn("This is a warning.");
logger.error("This is an error.");
logger.success("This is a success message.");
// no 'log', 'debug' and 'verbose' methods
```

Supports logging without new line and prefix:

```ts
import { Logger } from "@m234/logger";

const logger = new Logger("MyApp");
logger.inline("Starting machine...");
logger.inline("done\n");
// Starting machine...done
```

Or you can use the `start` and `end` methods for more control:

```ts
import { Logger } from "@m234/logger";

const logger = new Logger("MyApp");
logger.start("Operating");
// ⓘ [MyApp] Operating...
logger.end(); // clears the line
// ✔ [MyApp] Operating...done
```

The `error`, `success`, `info`, `warn` methods can be used to end the operation. All except `error` will end the operation as completed:

```ts
import { Logger } from "@m234/logger";
const logger = new Logger("MyApp");
logger.start("Operating");
// - [MyApp] Operating...
logger.error("An error occurred"); // clears the line
logger.end("completed"); // ignored
// ✖ [MyApp] Operating...failed
// ✖ [MyApp] An error occurred
```

> [!WARN]
> `logger.end` will <u>**not**</u> automatically used
> before `console.log` and `stdout/stderr.write`.
> Please, use `logger.end` and other log-methods to end the operations manually.
