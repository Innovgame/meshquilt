# @meshquilt/three

Read a `THREE.Mesh` and turn decoded chunks back into a `Group`.

## Install

```bash
npm install @meshquilt/three three
```

`three` is a peer dependency.

## Use

```ts
import { decodeMesh, encodeMesh } from "@meshquilt/three";

const buffer = await encodeMesh(mesh, {
    maxTriangles: 100_000,
    encodeChunk
});

const group = await decodeMesh(buffer, decodeChunk, mesh);
mesh.parent?.add(group);
```

The group copies the source mesh position, quaternion, and scale. Parent transforms stay on the parent. A mesh with an array of materials is rejected. Split groups into one mesh per material first.

`chunksToGroup` shares the source material across chunk meshes. It does not merge the chunk buffers.
