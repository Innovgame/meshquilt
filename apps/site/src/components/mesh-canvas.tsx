import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { splitGeometry } from "@meshquilt/core";
import { useSite } from "@/lib/site-context";

const colors = ["#8daedb", "#b3c9e6", "#ecaa88", "#6fae9c", "#5079b1", "#e5c5a9", "#93b8af", "#7a9bcc"];

export default function MeshCanvas({
    explode,
    wireframe,
    rotate
}: {
    explode: number;
    wireframe: boolean;
    rotate: boolean;
}) {
    const { t } = useSite();
    const host = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{ update: (explode: number, wireframe: boolean, rotate: boolean) => void } | null>(null);
    const values = useRef({ explode, wireframe, rotate });
    const [unavailable, setUnavailable] = useState(false);
    values.current = { explode, wireframe, rotate };

    useEffect(() => {
        const element = host.current;
        if (!element) return;
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch {
            setUnavailable(true);
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        element.appendChild(renderer.domElement);
        renderer.domElement.setAttribute("aria-label", "Interactive split torus knot / 可交互的分块环面纽结");
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
        camera.position.set(0, 0.6, 9.5);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = false;
        controls.enableZoom = false;
        controls.enableDamping = false;
        const group = new THREE.Group();
        group.rotation.set(0.25, -0.4, 0.1);
        scene.add(group);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x7b8a9e, 2.6));
        const light = new THREE.DirectionalLight(0xffffff, 3);
        light.position.set(-3, 5, 4);
        scene.add(light);
        const fill = new THREE.DirectionalLight(0xb2cfff, 1.5);
        fill.position.set(4, -1, -2);
        scene.add(fill);

        const source = new THREE.TorusKnotGeometry(1.15, 0.37, 180, 20, 2, 3);
        const chunks = splitGeometry(
            {
                position: new Float32Array(source.attributes.position!.array),
                normal: new Float32Array(source.attributes.normal!.array),
                uv: new Float32Array(source.attributes.uv!.array),
                index: new Uint32Array(source.index!.array)
            },
            450
        );
        const pieces = chunks.map((chunk, index) => {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(chunk.position, 3));
            geometry.setAttribute("normal", new THREE.BufferAttribute(chunk.normal!, 3));
            geometry.setIndex(new THREE.BufferAttribute(chunk.index, 1));
            geometry.computeBoundingBox();
            const direction = geometry.boundingBox!.getCenter(new THREE.Vector3()).normalize();
            const material = new THREE.MeshStandardMaterial({
                color: colors[index % colors.length],
                roughness: 0.48,
                metalness: 0.05,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
            return { mesh, direction, material };
        });
        source.dispose();
        let autoRotate = false;
        let visible = true;
        let frame = 0;
        let lastTime = 0;
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const draw = () => renderer.render(scene, camera);
        const animate = (time: number) => {
            frame = 0;
            if (!autoRotate || !visible || document.hidden || motion.matches) return;
            group.rotation.y += Math.min((time - lastTime) / 1000, 0.05) * 0.14;
            lastTime = time;
            draw();
            frame = requestAnimationFrame(animate);
        };
        const refresh = () => {
            cancelAnimationFrame(frame);
            frame = 0;
            if (autoRotate && visible && !document.hidden && !motion.matches) {
                lastTime = performance.now();
                frame = requestAnimationFrame(animate);
            }
            draw();
        };
        sceneRef.current = {
            update(amount, wire, rotation) {
                for (const { mesh, direction, material } of pieces) {
                    mesh.position.copy(direction).multiplyScalar((amount / 100) * 0.9);
                    material.wireframe = wire;
                }
                autoRotate = rotation;
                refresh();
            }
        };
        const resize = new ResizeObserver(() => {
            const { width, height } = element.getBoundingClientRect();
            if (!width || !height) return;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            draw();
        });
        resize.observe(element);
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? false;
            refresh();
        });
        observer.observe(element);
        const contextLost = (event: Event) => {
            event.preventDefault();
            autoRotate = false;
            cancelAnimationFrame(frame);
            setUnavailable(true);
        };
        renderer.domElement.addEventListener("webglcontextlost", contextLost);
        document.addEventListener("visibilitychange", refresh);
        motion.addEventListener("change", refresh);
        controls.addEventListener("change", draw);
        sceneRef.current.update(values.current.explode, values.current.wireframe, values.current.rotate);

        return () => {
            sceneRef.current = null;
            cancelAnimationFrame(frame);
            resize.disconnect();
            observer.disconnect();
            document.removeEventListener("visibilitychange", refresh);
            motion.removeEventListener("change", refresh);
            renderer.domElement.removeEventListener("webglcontextlost", contextLost);
            controls.dispose();
            for (const { mesh, material } of pieces) {
                mesh.geometry.dispose();
                material.dispose();
            }
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, []);

    useEffect(() => sceneRef.current?.update(explode, wireframe, rotate), [explode, wireframe, rotate]);

    return (
        <div className="mesh-canvas" ref={host}>
            {unavailable && (
                <div className="mesh-fallback">
                    <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="MeshQuilt" />
                    <p>
                        {t(
                            "3D preview needs WebGL. Explore the library in the docs.",
                            "三维预览需要 WebGL，可在文档中了解本库。"
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
