import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { splitGeometry } from "@meshquilt/core";
import { chunksToGroup, meshToGeometry } from "@meshquilt/three";

describe("meshToGeometry", () => {
    it("reads a THREE.Mesh and restores one child mesh per chunk", () => {
        const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
        mesh.name = "box";
        mesh.position.set(2, 3, 4);
        const geometry = meshToGeometry(mesh);
        expect(geometry.position.length).toBeGreaterThan(0);
        expect(geometry.normal).toBeDefined();
        expect(geometry.uv).toBeDefined();

        const chunks = splitGeometry(geometry, 4);
        const group = chunksToGroup(chunks, mesh);
        expect(group.name).toBe("box");
        expect(group.position.z).toBe(4);
        expect(group.children).toHaveLength(chunks.length);
    });
});
