# Quantization and seams

MeshQuilt copies a vertex into every chunk that uses it. If each chunk quantizes positions from its own bounding box, the same input can land on different grids. The decoded pieces then leave a crack.

Before encoding, MeshQuilt measures one position volume for the whole mesh. `origin` is the minimum corner. `range` is the largest axis span. Every chunk passes that volume to `SetAttributeExplicitQuantization` for `POSITION`.

UV uses the same rule. The volume is the union of the mesh UVs, not the UV box of one chunk. `TEX_COORD` is explicitly quantized with that origin and range.

Normals do not use a per-mesh box. Draco's octahedral encoder builds a grid from the bit count alone. Identical unit normals stay identical across chunks when `normalBits` matches. The encoder does not keep the original vector length.

A bit count of `0` skips quantization for that attribute. The defaults are 14 bits for positions, 8 for normals, and 10 for UVs.

Compute smooth normals on the complete mesh before splitting. Normals computed inside a chunk do not see the neighboring chunk, so the cut becomes a hard edge.

Draw the decoded chunks as separate meshes. Merging them back into one buffer rebuilds the large allocation the chunking step avoided.
