// Generated from src/worker.ts. Run pnpm --filter @meshquilt/draco build; do not edit.
"use strict";
(() => {
  // ../core/dist/types.js
  var MeshQuiltError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "MeshQuiltError";
    }
  };

  // src/encode-chunk.ts
  function createDracoChunkEncoder(module, settings = {}) {
    const encodeSpeed = settings.encodeSpeed ?? 5;
    const decodeSpeed = settings.decodeSpeed ?? 5;
    return function encodeDracoChunk(chunk, quant) {
      const encoder = new module.Encoder();
      const builder = new module.MeshBuilder();
      const mesh = new module.Mesh();
      const encoded = new module.DracoInt8Array();
      try {
        const pointCount = chunk.position.length / 3;
        const faceCount = chunk.index.length / 3;
        addAttribute(builder, mesh, module.POSITION, pointCount, 3, chunk.position, "POSITION");
        if (chunk.normal) {
          addAttribute(builder, mesh, module.NORMAL, pointCount, 3, chunk.normal, "NORMAL");
        }
        if (chunk.uv) {
          addAttribute(builder, mesh, module.TEX_COORD, pointCount, 2, chunk.uv, "TEX_COORD");
        }
        builder.AddFacesToMesh(mesh, faceCount, chunk.index);
        if (quant.positionBits > 0) {
          encoder.SetAttributeExplicitQuantization(
            module.POSITION,
            quant.positionBits,
            3,
            quant.position.origin,
            quant.position.range
          );
        }
        if (chunk.normal && quant.normalBits > 0) {
          encoder.SetAttributeQuantization(module.NORMAL, quant.normalBits);
        }
        if (chunk.uv && quant.uvBits > 0) {
          if (!quant.uv) throw new MeshQuiltError("UV quantization volume is missing");
          encoder.SetAttributeExplicitQuantization(
            module.TEX_COORD,
            quant.uvBits,
            2,
            quant.uv.origin,
            quant.uv.range
          );
        }
        encoder.SetSpeedOptions(encodeSpeed, decodeSpeed);
        encoder.SetEncodingMethod(module.MESH_EDGEBREAKER_ENCODING);
        const length = encoder.EncodeMeshToDracoBuffer(mesh, encoded);
        if (length <= 0) throw new MeshQuiltError("Draco encoding failed");
        const out = new Uint8Array(length);
        for (let i = 0; i < length; i++) out[i] = encoded.GetValue(i) & 255;
        return out;
      } finally {
        module.destroy(encoded);
        module.destroy(mesh);
        module.destroy(builder);
        module.destroy(encoder);
      }
    };
  }
  function addAttribute(builder, mesh, attribute, count, components, data, name) {
    if (builder.AddFloatAttributeToMesh(mesh, attribute, count, components, data) === -1) {
      throw new MeshQuiltError(`Draco failed to add ${name}`);
    }
  }

  // src/worker.ts
  var scope = globalThis;
  var encodeChunk;
  scope.onmessage = async ({ data }) => {
    if (data.type === "init") {
      try {
        const encoderScriptUrl = new URL(data.encoderScriptUrl, scope.location.href).href;
        scope.importScripts(encoderScriptUrl);
        if (typeof scope.DracoEncoderModule !== "function")
          throw new Error("DracoEncoderModule is missing after importScripts");
        const module = await scope.DracoEncoderModule({
          locateFile: (file) => file.endsWith(".wasm") && data.wasmUrl ? new URL(data.wasmUrl, scope.location.href).href : new URL(file, encoderScriptUrl).href
        });
        encodeChunk = createDracoChunkEncoder(module, data.settings);
        scope.postMessage({ type: "ready" });
      } catch (error) {
        scope.postMessage({ type: "ready", error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    if (data.type !== "encode") return;
    try {
      if (!encodeChunk) throw new Error("worker is not initialized");
      const bytes = encodeChunk(data.chunk, data.quant);
      scope.postMessage({ id: data.id, buffer: bytes.buffer }, [bytes.buffer]);
    } catch (error) {
      scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
    }
  };
})();
