import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createDisplayPieces } from "@/lib/mesh-display";
import type { MeshDisplayMode } from "@/lib/mesh-display";
import type { MeshModel } from "@/lib/mesh-model";
import { useSite } from "@/lib/site-context";

export default function MeshCanvas({
    explode,
    wireframe,
    rotate,
    model,
    displayMode,
    fitVersion
}: {
    explode: number;
    wireframe: boolean;
    rotate: boolean;
    model: MeshModel;
    displayMode: MeshDisplayMode;
    fitVersion: number;
}) {
    const { t } = useSite();
    const host = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{
        update: (explode: number, wireframe: boolean, rotate: boolean, mode: MeshDisplayMode) => void;
        fit: () => void;
    } | null>(null);
    const values = useRef({ explode, wireframe, rotate, displayMode });
    const [unavailable, setUnavailable] = useState(false);
    values.current = { explode, wireframe, rotate, displayMode };

    useEffect(() => {
        const element = host.current;
        if (!element) return;
        setUnavailable(false);
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
        renderer.domElement.setAttribute("aria-label", "Interactive chunked model / 可交互的分块模型");
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
        camera.position.set(0, 0.6, 9.5);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = false;
        controls.enableZoom = true;
        controls.minDistance = 2;
        controls.maxDistance = 30;
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

        let pieces: ReturnType<typeof createDisplayPieces> = [];
        let activeMode: MeshDisplayMode | undefined;
        const disposePieces = () => {
            for (const { mesh, material } of pieces) {
                group.remove(mesh);
                mesh.geometry.dispose();
                material.dispose();
            }
            pieces = [];
        };
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
            fit() {
                camera.position.set(0, 0.6, 9.5);
                controls.target.set(0, 0, 0);
                group.rotation.set(0.25, -0.4, 0.1);
                controls.update();
                refresh();
            },
            update(amount, wire, rotation, mode) {
                if (activeMode !== mode) {
                    disposePieces();
                    pieces = createDisplayPieces(model, mode);
                    for (const { mesh } of pieces) group.add(mesh);
                    activeMode = mode;
                    renderer.domElement.setAttribute(
                        "aria-label",
                        mode === "whole"
                            ? "Interactive whole mesh / 可交互的整体网格"
                            : "Interactive chunked model / 可交互的分块模型"
                    );
                }
                for (const { mesh, direction, material } of pieces) {
                    mesh.position.copy(direction).multiplyScalar(mode === "whole" ? 0 : (amount / 100) * 0.9);
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
        sceneRef.current.update(
            values.current.explode,
            values.current.wireframe,
            values.current.rotate,
            values.current.displayMode
        );

        return () => {
            sceneRef.current = null;
            cancelAnimationFrame(frame);
            resize.disconnect();
            observer.disconnect();
            document.removeEventListener("visibilitychange", refresh);
            motion.removeEventListener("change", refresh);
            renderer.domElement.removeEventListener("webglcontextlost", contextLost);
            controls.dispose();
            disposePieces();
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, [model]);

    useEffect(
        () => sceneRef.current?.update(explode, wireframe, rotate, displayMode),
        [explode, wireframe, rotate, displayMode]
    );
    useEffect(() => sceneRef.current?.fit(), [fitVersion]);

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
