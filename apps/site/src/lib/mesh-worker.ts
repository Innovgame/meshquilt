import { decodeContainer, decodeGeometry } from "meshquilt";
import { decodeDracoChunk } from "meshquilt/draco";
import type { DracoDecoderModule } from "meshquilt/draco";
import { importModel } from "./mesh-import.js";
import { demoModel, makeModel, mergePreviewGeometry, ModelError, modelErrorMessage } from "./mesh-model.js";
import { MAX_CHUNKS, MAX_FILE_BYTES, MAX_TRIANGLES, MAX_VERTICES } from "./mesh-limits.js";
import type { GeometryProgress } from "meshquilt";
import type { MeshModel } from "./mesh-model.js";
import type { ModelWorkerRequest } from "./mesh-worker-client.js";

const scope = globalThis as unknown as {
    onmessage: (event: MessageEvent<ModelWorkerRequest>) => void;
    postMessage: (data: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({ data }) => {
    try {
        let model: MeshModel;
        if (data.type === "demo") model = demoModel();
        else if (data.type === "split")
            model = makeModel(data.name, data.geometry, data.maxTriangles, data.sourceBytes);
        else if (data.type === "decode") {
            if (data.buffer.byteLength > MAX_FILE_BYTES) throw new ModelError("limit");
            const bytes = new Uint8Array(data.buffer);
            // Validate the container before loading WASM or allocating decoder output.
            const packed = decodeContainer(bytes, { copyChunks: false });
            if (packed.header.chunkCount > MAX_CHUNKS) throw new ModelError("limit");
            const { default: createDecoder } = (await import(/* @vite-ignore */ data.decoderUrl)) as {
                default: (options: { locateFile: (file: string) => string }) => Promise<DracoDecoderModule>;
            };
            const decoder = await createDecoder({ locateFile: () => data.wasmUrl });
            let vertices = 0;
            let triangles = 0;
            const decoded = await decodeGeometry(
                bytes,
                (chunk) => {
                    const geometry = decodeDracoChunk(decoder, chunk);
                    vertices += geometry.position.length / 3;
                    triangles += geometry.index.length / 3;
                    if (vertices > MAX_VERTICES || triangles > MAX_TRIANGLES) throw new ModelError("limit");
                    return geometry;
                },
                1,
                {
                    copyChunks: false,
                    onProgress: (progress: GeometryProgress) => scope.postMessage({ type: "progress", progress })
                }
            );
            model = {
                name: data.name,
                geometry: mergePreviewGeometry(decoded.chunks),
                chunks: decoded.chunks,
                header: decoded.header,
                sourceBytes: bytes.byteLength,
                positionRange: decoded.header.quantization.position.range
            };
        } else model = await importModel(data.name, data.buffer, data.maxTriangles);
        const transfers = new Set<ArrayBuffer>();
        for (const geometry of [model.geometry, ...model.chunks])
            for (const attribute of Object.values(geometry))
                if (attribute?.buffer instanceof ArrayBuffer) transfers.add(attribute.buffer);
        scope.postMessage({ type: "result", model }, [...transfers]);
    } catch (error) {
        scope.postMessage({ type: "error", code: modelErrorMessage(error) });
    }
};
