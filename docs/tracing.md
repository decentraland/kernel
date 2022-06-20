There is an option to trace debug commands between:

Kernel->Renderer
Renderer->Kernel
Kernel->Kernel (Redux messages)

The tool works in two ways, by query parameter or by console.

With query parameter, you must append `&TRACE_RENDERER=<Number of traces>` to the URL. It yields a final URL like this:

https://play.decentraland.zone/?position=0,0&TRACE_RENDERER=1000

From the browser's console, at any moment, execute the command:

```ts
beginTrace(1000) // to capture 1000 traces
```

Once you have completed the tracing type in the console the following command
```ts
endTrace()
```
The browser will download automatically the CSV file containing all the traced messages.
If the tracing is too big the results will be split in multiple files, in this case the browser might block the action and might ask for permission to multiple file download.

Traces have this format:

```csv
DIR <tab> TIMESTAMP <tab> HANDLER <tab> PAYLOAD
```

Where DIR can be KK KR RK, for Kernel->Kernel, Kernel->Renderer and Renderer->Kernel respectively. More directions may be added in the future for other components like voicechat and comms.
