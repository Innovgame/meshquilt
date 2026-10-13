import { expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Group, Mesh } from "three";
import { MeshQuiltError } from "meshquilt";
import { geometryFromScene, mergePreviewGeometry, ModelError } from "../src/lib/mesh-model.js";

function triangle(withAttributes: boolean, invalidNormal = false) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
    if (withAttributes) {
        geometry.setAttribute(
            "normal",
            new BufferAttribute(new Float32Array([invalidNormal ? NaN : 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3)
        );
        geometry.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2));
    }
    return new Mesh(geometry);
}

it("site explicitly drops mixed mesh attributes while retaining all geometry", () => {
    const scene = new Group();
    scene.add(triangle(true), triangle(false));
    const result = geometryFromScene(scene);
    expect(Array.from(result.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.normal).toBeUndefined();
    expect(result.uv).toBeUndefined();
});

it("invalid source attributes are rejected even if mixed import would discard them", () => {
    const scene = new Group();
    scene.add(triangle(true, true), triangle(false));
    expect(() => geometryFromScene(scene)).toThrow(MeshQuiltError);
});

it("site retains its empty-preview policy independently of the library", () => {
    expect(() => mergePreviewGeometry([])).toThrow(ModelError);
});
