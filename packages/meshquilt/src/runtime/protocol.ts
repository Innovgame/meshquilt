import type { ChunkGeometry, SharedQuantization } from "../types.js";
import type { DracoEncodeSettings } from "../codecs/draco/encode-chunk.js";

export type WorkerRequest =
    | { type: "init"; encoderScriptUrl: string; wasmUrl?: string; settings?: DracoEncodeSettings }
    | { type: "encode"; id: number; chunk: ChunkGeometry; quant: SharedQuantization };

export type WorkerResponse =
    { type: "ready"; error?: string } | { id: number; buffer: ArrayBuffer } | { id: number; error: string };
