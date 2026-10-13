import type { GeometryInput } from "meshquilt";

export function triangleCount(geometry: GeometryInput) {
    return (geometry.index?.length ?? geometry.position.length / 3) / 3;
}

export function geometryBytes(geometry: GeometryInput) {
    return (
        geometry.position.byteLength +
        (geometry.index?.byteLength ?? 0) +
        (geometry.normal?.byteLength ?? 0) +
        (geometry.uv?.byteLength ?? 0)
    );
}

export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
