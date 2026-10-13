# Three.js integration example

This private source example converts `THREE.Mesh` inputs and draws decoded chunks. It is not published; the `meshquilt` library has no Three.js dependency.

Copy [integration.ts](integration.ts) into your application and install `meshquilt` and `three` there.

Usage, input restrictions, transforms, validation and disposal are documented in one place:

- [English guide](../../docs/three.md)
- [简体中文](../../docs/zh/three.md)

Tests in `test/` cover current Three.js and the minimum supported version, 0.160.0. Run `pnpm test examples/three/test/mesh.test.ts` from the repository root.
