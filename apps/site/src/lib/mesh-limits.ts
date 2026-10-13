export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_TRIANGLES = 2_000_000;
export const MAX_VERTICES = 6_000_000;
export const MAX_CHUNKS = 1000;
// Higher normal bit counts can overflow Draco 1.5.7's octahedral arithmetic.
// Keep the UI within the range verified with nontrivial geometry.
export const MAX_NORMAL_BITS = 24;
