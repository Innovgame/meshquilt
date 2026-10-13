# Container format

The packed file is little-endian. The magic is `MQLT`. Version 1 is the only version this release writes.

| Offset | Field                                                                               |
| ------ | ----------------------------------------------------------------------------------- |
| 0      | 4-byte magic                                                                        |
| 4      | `uint16` version                                                                    |
| 6      | `uint16` flags. Bit 0 means the source had normals. Bit 1 means the source had UVs. |
| 8      | `uint32` chunk count                                                                |
| 12     | position bits, normal bits, UV bits, then one reserved byte                         |
| 16     | position origin `xyz` as three `float32` values, then `range` as `float32`          |
| 32     | UV origin `uv` as two `float32` values, then `range` as `float32`                   |
| 44     | repeated `uint32` byte length plus the encoder bytes                                |

`range` is the largest axis span. Position and UV origins are the minimum of the whole mesh. A chunk does not store its own origin in this header.

The bytes after each length are opaque to the container. The Draco adapter writes a Draco mesh there. Another encoder can use the same container if the decoder passed to `decodeGeometry` understands those bytes.

## Validation and ownership

Version 1 requires at least one chunk, known flags, a zero reserved byte, bit counts from 0 to 30, finite origins and positive finite ranges. A flagged UV attribute requires a valid UV volume. Truncated lengths/payloads and trailing bytes are rejected. An individual chunk length fits in uint32; the complete byte length must be a safe JavaScript integer and fit available memory.

Volumes are normalized to float32 before encoding so encoder callbacks see exactly the metadata stored in the header. Custom volumes must enclose the values your codec quantizes.

`decodeContainer` copies chunk payloads by default. Set `{ copyChunks: false }` to return input views instead. The views are valid only while the input remains alive and unmodified; do not detach its buffer while a decoder is using it.
