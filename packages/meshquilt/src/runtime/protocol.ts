import type { ChunkGeometry, GeometryInput, GeometryProgress, SharedQuantization } from "../types.js";
import type { EncodeGeometryOptions } from "../pipeline.js";
import type { DracoEncodeSettings } from "../codecs/draco/encode-chunk.js";

export type WorkerRequest =
    | { type: "init"; encoderScriptUrl: string; wasmUrl?: string; settings?: DracoEncodeSettings }
    | { type: "encode"; id: number; chunk: ChunkGeometry; quant: SharedQuantization }
    | {
          type: "encodeGeometry";
          id: number;
          geometry: GeometryInput;
          options: Omit<EncodeGeometryOptions, "encodeChunk" | "onProgress" | "signal" | "concurrency">;
      };

export type WorkerResponse =
    | { type: "ready"; error?: string }
    | { id: number; buffer: ArrayBuffer }
    | { id: number; error: string }
    | { type: "progress"; id: number; progress: GeometryProgress };
