# Three.js integration

Read a `THREE.Mesh` and turn decoded chunks back into a `Group`.

## Install

```bash
npm install meshquilt three
```

This is a private integration example, not an npm package. Copy `integration.ts` into your application and install Three.js there. The published `meshquilt` package has no Three.js dependency or peer dependency.

## Use

```ts
import { decodeMesh, encodeMesh } from "./integration";

const buffer = await encodeMesh(mesh, {
    maxTriangles: 100_000,
    encodeChunk
});

const group = await decodeMesh(buffer, decodeChunk, mesh);
mesh.parent?.add(group);
```

The group copies the source mesh position, quaternion, and scale. Parent transforms stay on the parent. A mesh with an array of materials is rejected. Split groups into one mesh per material first.

Custom local matrices are preserved when `matrixAutoUpdate` is false. The source's parent transform is applied by adding the result to that same parent.

Encoding rejects multi-material, skinned, instanced and morph-target meshes before the encoder runs. Bake animated/deformed or instanced data to static geometry first. Partial `drawRange` values must be extracted into a separate geometry. Single-material groups do not need separate handling. Indexed and non-indexed triangle meshes, normalized and interleaved attributes are supported; the minimum tested Three.js version is 0.160.0.

`chunksToGroup` shares the source material across chunk meshes. It does not merge the chunk buffers.

Dispose each child geometry when removing the decoded group. Its material belongs to the caller and may still be used by the source or other meshes; do not dispose it just because a chunk is removed. The adapter copies source attribute buffers before encoding and does not transfer the original Three.js arrays.

`EncodeMeshOptions` shares the core encode options, including `signal`. `decodeMesh(buffer, decodeChunk, source, concurrency, options)` accepts `copyChunks` and `signal` in the final options argument.

`meshToGeometry` validates its returned arrays. `encodeMesh` converts once and lets the core encoder validate numeric geometry while preparing shared quantization, avoiding another full scan. Numeric geometry errors reject its Promise; unsupported mesh kinds, materials and attributes are rejected synchronously during conversion.
