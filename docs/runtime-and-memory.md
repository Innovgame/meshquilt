# Runtime, memory and cancellation

MeshQuilt bounds the geometry passed to each encoder. This does not make the complete-buffer API constant-memory.

## Encoding working set

The core accepts geometry arrays directly, measures shared quantization and validates the geometry before splitting. `encodeGeometry` pulls chunks from a lazy iterator only when an encoder slot is available. Apart from splitter scratch space, no more than `concurrency` uncompressed chunks need to be in flight. Uint16/Uint32 indices are accepted; for nonindexed triangle soup, indices are created within each chunk. Copying Three.js input attributes belongs only to the integration example.

The source arrays, each Worker WASM heap, accumulated compressed chunk bytes and the final MQLT buffer still require memory. Packing temporarily holds compressed payloads and the final output together. The API has no streaming output sink, and validation/conversion/splitting run on the calling thread. Do not describe this as a fixed total-memory or fully off-thread codec.

`splitGeometry` materializes an array. Use `iterateGeometry` for custom bounded pipelines. A single-chunk Uint32 input returns the source geometry itself. Small Uint16/nonindexed inputs normalize only their index and share attributes; multiple chunks copy attributes. Do not mutate or detach the source during encoding.

## Decode ownership

`decodeContainer` and `decodeGeometry` copy compressed payloads by default. `{ copyChunks: false }` avoids those copies but retains views into the original container. Keep the container alive and unchanged until all decoders finish; a decoder must not transfer those shared views.

Decoded output remains raw independent geometry chunks, with no materials or rendering objects. The private Three.js example creates separate geometries but shares the source material. Dispose generated example geometries when removing the result; material lifetime remains the application's responsibility.

## Failure and cancellation

Both encodeGeometry and decodeGeometry accept onProgress, reporting stage, completedChunks and totalChunks initially and after successful chunks. Observer return values do not cancel work. If an observer throws, the operation rejects after in-flight jobs settle. Use AbortSignal for cancellation.

`mapPool` accepts an iterable, preserves input order and stops requesting new items after the first task failure. It waits for already started calls to settle before rejecting with the first failure. This prevents callers from releasing shared resources while library-managed calls continue to run. It cannot interrupt an arbitrary user callback that never settles.

Pass `signal` to `encodeGeometry`, or in the final options argument to `decodeGeometry`, to stop scheduling. Cancellation is checked between jobs and cannot interrupt synchronous JavaScript. Pass the same signal to `createDracoWorkerPool` to terminate Worker/WASM execution immediately and reject queued jobs. `dispose()` has the same cleanup behavior. Set `timeoutMs` when a 30-second per-startup/per-job timeout is unsuitable.

## Supported tools

Development requires Node.js 22.12+, 24+ or 26+ and pnpm 10.33.0. Production library code is ESM, with `.js` relative specifiers; packed artifact tests verify native ESM imports and consumer declaration resolution. The Three adapter tests 0.160.0 and the current development version.

TypeScript 7 (`typescript-compiler`) runs builds and type checks. The newest typescript-eslint currently requires the TypeScript 6 API, so the root `typescript` package intentionally remains on 6.0.3. Keep that compatibility dependency until ESLint supports the new API. `three-min` is intentionally pinned to 0.160.0 as a minimum-version test fixture. Other direct dependencies track the latest stable versions available at upgrade time.

## Acceptance checks

```bash
pnpm check
pnpm test
pnpm test:packages
pnpm --filter meshquilt exec playwright install chromium
pnpm test:workers
pnpm site:test
pnpm build
```

The real Draco tests cover multi-chunk round trips and coincident boundaries. The browser Worker check exercises classic Workers, matching WASM assets, parallel encoding and caller-owned buffers. These are correctness checks, not performance or peak-memory benchmarks.
