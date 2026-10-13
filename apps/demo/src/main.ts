import { computeVolume, quantizeComponent, splitGeometry } from "meshquilt";
import { chunkToGeometry, meshToGeometry } from "../../../examples/three/integration";
import {
    AmbientLight,
    Color,
    DirectionalLight,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Scene,
    WebGLRenderer
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const CLAY = [0xc47a45, 0x8c9a6b, 0xd7c4a3, 0x6e4b3a, 0xb85c38, 0x4f6f6a];

const stage = document.querySelector<HTMLElement>("#stage")!;
const stats = document.querySelector<HTMLElement>("#stats")!;
const maxTriangles = document.querySelector<HTMLInputElement>("#maxTriangles")!;
const maxTrianglesOut = document.querySelector<HTMLOutputElement>("#maxTrianglesOut")!;

const scene = new Scene();
scene.background = new Color(0x14110e);
const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(8, 7, 10);
const renderer = new WebGLRenderer({ antialias: true });
stage.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.4, 0);

scene.add(new AmbientLight(0xf2e4d0, 0.55));
const sun = new DirectionalLight(0xfff1dc, 1.4);
sun.position.set(4, 8, 3);
scene.add(sun);

const source = createTerrain();
let shown: Mesh | Mesh[] = source;
scene.add(source);

function createTerrain(): Mesh {
    const geometry = new PlaneGeometry(12, 12, 60, 60);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        position.setY(i, Math.sin(x * 0.65) * Math.cos(z * 0.45) * 1.2);
    }
    geometry.computeVertexNormals();
    return new Mesh(geometry, new MeshStandardMaterial({ color: 0xd7c4a3, roughness: 0.86, metalness: 0 }));
}

function showSolid(): void {
    clearShown();
    scene.add(source);
    shown = source;
    writeStats(1, seamReport(Number(maxTriangles.value)));
}

function showChunks(): void {
    const limit = Number(maxTriangles.value);
    const geometry = meshToGeometry(source);
    const chunks = splitGeometry(geometry, limit);
    clearShown();
    const meshes = chunks.map((chunk, index) => {
        const mesh = new Mesh(
            chunkToGeometry(chunk),
            new MeshStandardMaterial({ color: CLAY[index % CLAY.length], roughness: 0.86, metalness: 0 })
        );
        scene.add(mesh);
        return mesh;
    });
    shown = meshes;
    writeStats(chunks.length, seamReport(limit));
}

function seamReport(limit: number): { shared: number; mismatched: number } {
    const geometry = meshToGeometry(source);
    const chunks = splitGeometry(geometry, limit);
    const seen = new Map<string, { chunks: number; localKeys: Set<string> }>();
    for (const chunk of chunks) {
        const local = computeVolume(chunk.position, 3);
        const inChunk = new Set<string>();
        for (let i = 0; i < chunk.position.length; i += 3) {
            const exact = `${chunk.position[i]},${chunk.position[i + 1]},${chunk.position[i + 2]}`;
            if (inChunk.has(exact)) continue;
            inChunk.add(exact);
            const localKey = [0, 1, 2]
                .map((c) => quantizeComponent(chunk.position[i + c]!, local.origin[c]!, local.range, 14).toFixed(5))
                .join(",");
            const record = seen.get(exact) ?? { chunks: 0, localKeys: new Set<string>() };
            record.chunks += 1;
            record.localKeys.add(localKey);
            seen.set(exact, record);
        }
    }
    let shared = 0;
    let mismatched = 0;
    for (const record of seen.values()) {
        if (record.chunks < 2) continue;
        shared++;
        if (record.localKeys.size > 1) mismatched++;
    }
    return { shared, mismatched };
}

function writeStats(chunkCount: number, seam: { shared: number; mismatched: number }): void {
    const triangles = source.geometry.getIndex()!.count / 3;
    stats.innerHTML = `
    <dt>三角面</dt><dd>${triangles}</dd>
    <dt>块数</dt><dd>${chunkCount}</dd>
    <dt>共用网格上的重复点</dt><dd>${seam.shared}</dd>
    <dt>各自量化后会错开的点</dt><dd>${seam.mismatched}</dd>
  `;
}

function clearShown(): void {
    const meshes = Array.isArray(shown) ? shown : [shown];
    for (const mesh of meshes) {
        scene.remove(mesh);
        if (mesh === source) continue;
        mesh.geometry.dispose();
        if (!Array.isArray(mesh.material)) mesh.material.dispose();
    }
}

function resize(): void {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
}

maxTriangles.addEventListener("input", () => {
    maxTrianglesOut.textContent = maxTriangles.value;
});
document.querySelector("#split")!.addEventListener("click", showChunks);
document.querySelector("#solid")!.addEventListener("click", showSolid);

resize();
showSolid();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
});
