# Migration to one package

MeshQuilt now publishes only `meshquilt`. The former scoped package source has been consolidated internally; the MQLT v1 format, quantization defaults and codec callback behavior are preserved.

## Imports

| Former import           | New import                                                                  |
| ----------------------- | --------------------------------------------------------------------------- |
| @meshquilt/core         | meshquilt                                                                   |
| @meshquilt/draco        | meshquilt/draco                                                             |
| @meshquilt/draco/worker | meshquilt/worker                                                            |
| @meshquilt/three        | Copy the tested examples/three/integration.ts helper into your application. |

The package has no Three.js dependency. The old adapter helpers retain their conversion, validation, material and transform behavior in the private source example. The root and Draco entrypoints do not create rendering objects or install Worker handlers.

## Array input

Use GeometryInput for input arrays; Uint16Array, Uint32Array or missing indices are supported. GeometryBuffers and ChunkGeometry still describe normalized Uint32-indexed output. Material/group restrictions are specific to Three.js integration, not array encoding. The core does not load model files or preserve arbitrary custom attributes.

Both encodeGeometry and decodeGeometry support typed onProgress events. Continue using signal for cancellation. The callbacks and the container remain compatible with existing MeshQuilt data.
