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
logger.end(true); // clears the line
// ✔ [MyApp] Operating...done
```

The `error` and `success` methods can be used to end the operation:

> [!NOTE]
> The `info` and `warn` methods are ending the operation as success.

```ts
import { Logger } from "@m234/logger";
const logger = new Logger("MyApp");
logger.start("Operating");
// - [MyApp] Operating...
logger.error("An error occurred"); // clears the line
logger.end(true); // ignored
// ✖ [MyApp] Operating...fail
// ✖ [MyApp] An error occurred
```
