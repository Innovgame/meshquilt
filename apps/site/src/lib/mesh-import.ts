import { Mesh } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { geometryFromScene, makeModel, ModelError } from "./mesh-model.js";
import { MAX_FILE_BYTES } from "./mesh-limits.js";

// Strip rendering-only resources before GLTFLoader runs. The viewer imports static
// geometry and must never fetch an OBJ material, GLB texture, or external buffer.
function geometryOnlyGlb(buffer: ArrayBuffer) {
    if (buffer.byteLength < 20) throw new ModelError("invalid");
    const view = new DataView(buffer);
    if (
        view.getUint32(0, true) !== 0x46546c67 ||
        view.getUint32(4, true) !== 2 ||
        view.getUint32(8, true) !== buffer.byteLength ||
        view.getUint32(16, true) !== 0x4e4f534a
    )
        throw new ModelError("invalid");
    const length = view.getUint32(12, true);
    if (length > buffer.byteLength - 20) throw new ModelError("invalid");
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
    if (
        json.buffers?.some((item: { uri?: string }) => item.uri) ||
        json.skins?.length ||
        json.animations?.length ||
        json.extensionsUsed?.some((name: string) =>
            ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "EXT_mesh_gpu_instancing"].includes(name)
        ) ||
        json.meshes?.some((mesh: { primitives: { mode?: number; targets?: unknown[] }[] }) =>
            mesh.primitives.some(
                (primitive) => (primitive.mode !== undefined && primitive.mode !== 4) || primitive.targets?.length
            )
        )
    )
        throw new ModelError("unsupported");
    delete json.images;
    delete json.textures;
    delete json.samplers;
    delete json.materials;
    for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives) delete primitive.material;
    const encoded = new TextEncoder().encode(JSON.stringify(json));
    const padded = Math.ceil(encoded.length / 4) * 4;
    const tail = new Uint8Array(buffer, 20 + length);
    const result = new ArrayBuffer(20 + padded + tail.length);
    const output = new DataView(result);
    output.setUint32(0, 0x46546c67, true);
    output.setUint32(4, 2, true);
    output.setUint32(8, result.byteLength, true);
    output.setUint32(12, padded, true);
    output.setUint32(16, 0x4e4f534a, true);
    const bytes = new Uint8Array(result);
    bytes.fill(0x20, 20, 20 + padded);
    bytes.set(encoded, 20);
    bytes.set(tail, 20 + padded);
    return result;
}

export async function importModel(name: string, buffer: ArrayBuffer, maxTriangles: number) {
    if (buffer.byteLength > MAX_FILE_BYTES) throw new ModelError("limit");
    const extension = name.split(".").pop()?.toLowerCase();
    let scene;
    if (extension === "stl") scene = new Mesh(new STLLoader().parse(buffer));
    else if (extension === "obj") scene = new OBJLoader().parse(new TextDecoder().decode(buffer));
    else if (extension === "glb") scene = (await new GLTFLoader().parseAsync(geometryOnlyGlb(buffer), "")).scene;
    else throw new ModelError("unsupported");
    return makeModel(name, geometryFromScene(scene), maxTriangles, buffer.byteLength);
}
