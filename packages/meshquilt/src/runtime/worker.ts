import { createDracoChunkEncoder } from "../codecs/draco/encode-chunk.js";
import type { DracoEncoderModule } from "../codecs/draco/types.js";
import type { WorkerRequest, WorkerResponse } from "./protocol.js";
import { encodeGeometry } from "../pipeline.js";

interface EncoderWorkerScope {
    location: { href: string };
    onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
    importScripts: (...urls: string[]) => void;
    postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
    DracoEncoderModule?: (options: { locateFile: (file: string) => string }) => Promise<DracoEncoderModule>;
}

const scope = globalThis as unknown as EncoderWorkerScope;
let encodeChunk: ReturnType<typeof createDracoChunkEncoder> | undefined;

scope.onmessage = async ({ data }) => {
    if (data.type === "init") {
        try {
            const encoderScriptUrl = new URL(data.encoderScriptUrl, scope.location.href).href;
            scope.importScripts(encoderScriptUrl);
            if (typeof scope.DracoEncoderModule !== "function")
                throw new Error("DracoEncoderModule is missing after importScripts");
            const module = await scope.DracoEncoderModule({
                locateFile: (file) =>
                    file.endsWith(".wasm") && data.wasmUrl
                        ? new URL(data.wasmUrl, scope.location.href).href
                        : new URL(file, encoderScriptUrl).href
            });
            encodeChunk = createDracoChunkEncoder(module, data.settings);
            scope.postMessage({ type: "ready" });
        } catch (error) {
            scope.postMessage({ type: "ready", error: error instanceof Error ? error.message : String(error) });
        }
        return;
    }
    if (data.type !== "encode" && data.type !== "encodeGeometry") return;
    try {
        if (!encodeChunk) throw new Error("worker is not initialized");
        const bytes =
            data.type === "encode"
                ? encodeChunk(data.chunk, data.quant)
                : await encodeGeometry(data.geometry, {
                      ...data.options,
                      encodeChunk,
                      onProgress(progress) {
                          scope.postMessage({ type: "progress", id: data.id, progress });
                      }
                  });
        scope.postMessage({ id: data.id, buffer: bytes.buffer as ArrayBuffer }, [bytes.buffer]);
    } catch (error) {
        scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
    }
};
