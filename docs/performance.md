# Performance and benchmark workflow

For million-triangle browser workloads where memory and responsiveness matter most, use `encodeDracoInWorker`. It moves validation, shared-volume calculation, splitting, encoding and MQLT packing into one dedicated Worker. Use `transferInput: true` only when the caller can give up ownership of the input buffers.

```ts
import { encodeDracoInWorker } from "meshquilt/draco";

const bytes = await encodeDracoInWorker(geometry, {
    workerUrl,
    encoderScriptUrl: "/draco/draco_encoder.js",
    maxTriangles: 100_000,
    transferInput: true,
    timeoutMs: 120_000,
    signal,
    onProgress({ completedChunks, totalChunks }) {
        console.log(completedChunks, totalChunks);
    }
});
```

The Worker is created per call and terminated on completion, failure, timeout or cancellation. `timeoutMs` covers the complete operation, including startup; the default is 30 seconds. Unlike a warmed pool, this API includes module startup on each operation. It optimizes responsiveness and limits the number of WASM heaps, rather than maximizing multicore throughput.

## Input ownership and memory

The default is `transferInput: false`: structured cloning preserves caller-owned arrays and copies their backing buffers. This can temporarily duplicate model-sized memory and cause a main-thread copy pause. SharedArrayBuffers remain shared, not copied; do not mutate shared inputs until the operation finishes.

With `transferInput: true`, input ArrayBuffers are transferred after Draco initialization succeeds. All views sharing those buffers become detached. This also happens if later encoding fails or is cancelled: the API does not return the original buffers. Do not use this mode with buffers the renderer still needs. Distinct attributes sharing one buffer are transferred together once.

Output is still a complete MQLT buffer, and accumulated compressed payloads still occupy memory. This is not a streaming-output or constant-total-memory API. The published package remains dependency-free at the root; Draco scripts/WASM and the Worker asset are supplied by the application.

## Standard runners

```bash
pnpm bench
pnpm bench -t 1m-soup
pnpm bench:browser
pnpm test:workers
```

`pnpm bench` runs TypeScript `.bench.ts` files through the existing Vitest configuration. Vitest 5's test-context `bench` API handles timing, warmup, samples, comparison tables and JSON artifacts. Results are saved under `.tmp/performance/vitest/current`. The fixture suite covers about 100k, 500k, 1m and 2m triangles, including nonindexed triangle soup, at 14/8/10 quantization bits and a 100k-triangle chunk budget. At least five measured iterations are used per stage; fixture creation and module initialization are outside the timed function.

For a before/after comparison, point `MESHQUILT_BENCH_DIST` at a compiled baseline package. For example in PowerShell:

```powershell
$env:MESHQUILT_BENCH_DIST = 'D:/path/to/baseline/packages/meshquilt/dist'
pnpm bench
Remove-Item Env:MESHQUILT_BENCH_DIST
pnpm bench
```

Both versions run in the same Vitest harness with the same fixtures. Baseline results are saved separately and loaded through `bench.from` for subsequent comparisons. Keep the baseline build and its source maps together. Timing depends on the runtime, GC state, topology and machine; compare runs on an otherwise idle machine and do not equate Vitest and browser absolute times.

`pnpm bench:browser` uses `packages/meshquilt/playwright.config.ts` and its `library-performance` project, with one worker. It shares the typed browser/Draco asset fixture with `pnpm test:workers`; all page, Worker and WASM requests are fulfilled directly by that fixture. No website build, HTTP server or standalone benchmark runner is needed. Twenty-four scenarios compare direct encoding, 1/2/4 pooled Workers and whole-pipeline copy/transfer modes. Each uses three samples and emits medians for total encoding time, 5ms timer delay, long-task count and observed WASM heap capacity. Results are attached under `.tmp/performance/playwright`. No hardware-specific timing thresholds run in normal CI.

Browser fixtures route local Draco/Worker assets through Playwright and use an empty page, so benchmark traffic does not depend on a CDN or the website's rendering. Pooled/direct modes are warmed and report startup separately. Whole-pipeline modes include their per-call Worker startup. Fixture generation and transfer-mode input preparation are outside responsiveness observation. WASM capacity includes active encoder heaps, not total browser RSS; the 5ms heartbeat is an event-loop responsiveness signal, not a rendered-frame measurement.

## Geometry preparation and validation

The encoder uses one internal preparation boundary: shape and option checks happen first, index bounds and normals are scanned once, and position/UV finiteness is checked while calculating their shared bounds. Explicit `positionVolume`/`uvVolume` values skip bounds calculation but retain input finiteness checks. All chunks still receive the same float32-normalized quantization; defaults remain 14/8/10. Public `validateGeometry` and standalone splitting validate independently, and container metadata checks remain enabled. Validation is never cached by mutable array identity.

Run `pnpm bench -t 'validation cost'` for the TypeScript/Vitest comparison. It measures separate public quantization plus validation against the internal preparation path, including supplied volumes, at least 20 measured iterations and 20 warmup iterations. Results go to `.tmp/performance/validation`. Fixture creation and correctness assertions are outside timing. The separate-scan comparison uses the current public validator; it is not a frozen historical binary.

Local medians on 2026-10-13, Node 26.5.0, about one million triangles with normals and UVs:

| Fixture / volumes          | Separate scans | Prepared | Reduction |
| -------------------------- | -------------: | -------: | --------: |
| Indexed / calculated       |       11.58 ms |  7.51 ms |       35% |
| Triangle soup / calculated |       48.72 ms | 34.14 ms |       30% |
| Indexed / supplied         |        9.93 ms |  5.41 ms |       45% |
| Triangle soup / supplied   |       48.57 ms | 22.28 ms |       54% |

These are preprocessing reductions, not complete Draco encoding reductions. This comparison pinned the benchmark process and child workers to CPU 0 on Windows to reduce scheduling differences on the i9-14900KF's mixed core types. Unpinned runs varied substantially and even showed a misleading indexed regression. For the same optional pinning in a temporary PowerShell process:

```powershell
pwsh -NoProfile -Command '(Get-Process -Id $PID).ProcessorAffinity = [IntPtr]1; pnpm bench -t "validation cost"'
```

Reducing scans does not make synchronous preparation yield to browser rendering. The whole-operation Worker remains the preferred path for responsiveness.

## Encoding and Worker measurements

Measured locally on 2026-10-13: Intel Core i9-14900KF, 32 logical CPUs, about 64 GiB RAM, Windows, Node 26.5.0, Draco 1.5.7 and headless Chromium. The baseline is commit `cfec9e7`; the optimized code is commit `d7417ff`, before the preparation consolidation described above. Generated heightfields have positions, smooth normals and UVs. They are reproducible proxies, not a substitute for the application's real models.

Vitest median stage timings, with unchanged quantization and chunk budget:

| Fixture          | Split before / after | Encode before / after | Encode reduction |
| ---------------- | -------------------- | --------------------- | ---------------- |
| 100k indexed     | 9.1 / 3.4 ms         | 44.7 / 37.8 ms        | 15%              |
| 500k indexed     | 81.6 / 29.3 ms       | 448.1 / 327.7 ms      | 27%              |
| 1m indexed       | 171.9 / 56.0 ms      | 819.1 / 665.4 ms      | 19%              |
| 1m triangle soup | 974.3 / 100.7 ms     | 1926.4 / 998.3 ms     | 48%              |
| 2m indexed       | 375.0 / 204.1 ms     | 1662.9 / 1401.2 ms    | 16%              |

The largest improvement is the nonindexed path, which no longer constructs a vertex Map or per-vertex attribute views. Indexed geometry uses a bounded dense lookup when appropriate, with a sparse Map fallback; its lookup storage is capped relative to the chunk budget. The encode pipeline avoids duplicate full-geometry validation. Decoding uses Draco's optional bulk WASM APIs and preserves a portable fallback. Its measured gain is smaller and more variable; do not interpret it as a guaranteed speedup on every mesh.

Optimized Playwright measurements for about one million triangles:

| Fixture / mode                         | Encode median | Main-thread timer delay median | Encoder WASM capacity |
| -------------------------------------- | ------------- | ------------------------------ | --------------------- |
| Indexed / 4 pooled Workers             | 128 ms        | 17.0 ms                        | 77 MiB                |
| Indexed / whole Worker, copy           | 420 ms        | 8.9 ms                         | 19 MiB                |
| Indexed / whole Worker, transfer       | 407 ms        | 1.6 ms                         | 19 MiB                |
| Triangle soup / 4 pooled Workers       | 211 ms        | 51.8 ms                        | 133 MiB               |
| Triangle soup / whole Worker, copy     | 616 ms        | 29.4 ms                        | 33 MiB                |
| Triangle soup / whole Worker, transfer | 574 ms        | 1.3 ms                         | 33 MiB                |

The two-million indexed whole-Worker transfer case measured 820 ms total, 1.6 ms timer delay and 19 MiB encoder WASM capacity. All whole-Worker cases in this run had zero observed long tasks. Four pooled Workers finished that model in 237 ms, using 77 MiB of encoder WASM and about 40 ms timer delay.

For the stated priority of keeping million-plus models responsive with fewer heaps, prefer whole-Worker transfer when ownership permits it. Choose two pooled Workers when preserving input and throughput matter more; four trades additional WASM memory for speed and can still leave preprocessing pauses. Increasing Worker count does not move caller-side preprocessing out of the main thread.

Correctness checks verified identical compressed bytes between baseline and optimized code for these fixtures, and between pooled/whole-Worker paths for an integration fixture. Shared positionRange and quantization precision remain unchanged. Keep seam tests alongside performance measurements; faster timings do not prove geometry correctness.
