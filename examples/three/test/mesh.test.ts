import { describe, expect, it } from "vitest";
import {
    BoxGeometry,
    Mesh,
    MeshBasicMaterial,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    BufferGeometry,
    SkinnedMesh
} from "three";
import * as LegacyThree from "three-min";
import { splitGeometry } from "meshquilt";
import { chunksToGroup, meshToGeometry, encodeMesh } from "../integration";

describe("meshToGeometry", () => {
    it.each([LegacyThree, { InterleavedBuffer, InterleavedBufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial }])(
        "reads interleaved positions across supported Three versions",
        (three) => {
            const buffer = new three.InterleavedBuffer(new Float32Array([0, 0, 0, 99, 1, 0, 0, 99, 0, 1, 0, 99]), 4);
            const geometry = new three.BufferGeometry();
            geometry.setAttribute("position", new three.InterleavedBufferAttribute(buffer, 3, 0));
            const result = meshToGeometry(new three.Mesh(geometry, new three.MeshBasicMaterial()));
            expect(result.position).toEqual(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]));
            expect(result.index).toEqual(new Uint32Array([0, 1, 2]));
        }
    );

    it("rejects multi-material meshes before calling the encoder", () => {
        const mesh = new Mesh(new BoxGeometry(), [new MeshBasicMaterial()]);
        let called = false;
        expect(() =>
            encodeMesh(mesh, {
                encodeChunk() {
                    called = true;
                    return new Uint8Array([1]);
                }
            })
        ).toThrow(/multi-material/);
        expect(called).toBe(false);
    });

    it("rejects partial draw ranges rather than silently encoding hidden faces", () => {
        const geometry = new BoxGeometry();
        geometry.setDrawRange(3, 3);
        expect(() => meshToGeometry(new Mesh(geometry, new MeshBasicMaterial()))).toThrow(/drawRange/);
    });

    it("rejects skinned and morph geometry rather than losing deformation data", () => {
        expect(() => meshToGeometry(new SkinnedMesh(new BoxGeometry(), new MeshBasicMaterial()))).toThrow(/skinned/);
        const geometry = new BoxGeometry();
        geometry.morphAttributes.position = [geometry.getAttribute("position").clone()];
        expect(() => meshToGeometry(new Mesh(geometry, new MeshBasicMaterial()))).toThrow(/morph/);
    });

    it("preserves custom local matrices and parent transforms", () => {
        const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
        mesh.matrixAutoUpdate = false;
        mesh.matrix.makeTranslation(7, 8, 9);
        const group = chunksToGroup(splitGeometry(meshToGeometry(mesh), 4), mesh);
        const parent = new Mesh();
        parent.position.set(10, 20, 30);
        parent.add(group);
        parent.updateMatrixWorld(true);
        expect(group.matrixAutoUpdate).toBe(false);
        expect(group.matrix.elements).toEqual(mesh.matrix.elements);
        expect(group.matrixWorld.elements.slice(12, 15)).toEqual([17, 28, 39]);
    });
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
