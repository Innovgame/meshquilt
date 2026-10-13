# Examples

- [Three.js integration](three/README.md): tested helpers for mesh conversion, transforms and resource ownership. Copy the source into your application; it is not a published adapter.
- [Array-first quick start](../docs/quick-start.md): prepare typed arrays, initialize Draco and encode/decode chunks.
- [Browser Workers](../docs/workers.md): deploy the Worker asset and choose whole-pipeline or pooled encoding.

Run `pnpm site` for the interactive geometry preview and documentation. Run `pnpm test:workers` for actual browser Draco encoding and `pnpm bench:browser` for reproducible performance measurements.
