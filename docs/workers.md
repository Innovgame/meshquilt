# Browser Workers

Import `createDracoWorkerPool` from `meshquilt/draco`. Deploy the `meshquilt/worker` export as a classic Worker asset; it is generated from the same typed encoder implementation used by the direct adapter.

## Asset deployment

Provide workerUrl and encoderScriptUrl. Relative encoder URLs resolve from the Worker location; absolute or root-relative URLs avoid ambiguity. Matching encoder WASM files default to the encoder script's directory, or use wasmUrl to select another location. MeshQuilt does not bundle Draco scripts or WASM.

## Scheduling and ownership

Use a pool of 2–4 Workers, with encodeGeometry concurrency matching the pool size. The core generates uncompressed chunks lazily. The pool copies a chunk only when a Worker is available and transfers those copies; your input arrays remain attached.

## Failure and cancellation

Initialization and individual jobs default to a 30-second timeout; timeoutMs can increase that limit. A timeout, runtime Worker error, abort or dispose terminates the entire pool and rejects active, queued and future calls. Initialization failure cleans up partially created Workers. A codec-reported failure rejects that job while leaving the pool usable.

Pass a shared signal to the pool and encodeGeometry when you need immediate Worker termination. dispose is idempotent; call it in finally. Direct Draco modules and Worker pools are optional: the root geometry API accepts your own codec callbacks.
