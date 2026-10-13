/**
 * Classic worker. Load a draco_encoder.js that exposes DracoEncoderModule, then
 * encode chunks posted by createDracoWorkerPool.
 *
 * The quantization calls match packages/draco/src/encode-chunk.ts.
 */
let encodeChunk = null;

self.onmessage = async (event) => {
    const data = event.data;
    if (data.type === "init") {
        try {
            importScripts(data.encoderScriptUrl);
            const factory = self.DracoEncoderModule;
            if (typeof factory !== "function") {
                throw new Error("DracoEncoderModule is missing after importScripts");
            }
            const module = await factory({});
            encodeChunk = createEncoder(module);
            self.postMessage({ type: "ready" });
        } catch (error) {
            self.postMessage({ type: "ready", error: error instanceof Error ? error.message : String(error) });
        }
        return;
    }

    if (data.type !== "encode") return;
    if (!encodeChunk) {
        self.postMessage({ id: data.id, error: "worker is not initialized" });
        return;
    }
    try {
        const buffer = encodeChunk(data.chunk, data.quant);
        self.postMessage({ id: data.id, buffer: buffer.buffer }, { transfer: [buffer.buffer] });
    } catch (error) {
        self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
    }
};

function createEncoder(module) {
    return function encode(chunk, quant) {
        const encoder = new module.Encoder();
        const builder = new module.MeshBuilder();
        const mesh = new module.Mesh();
        const encoded = new module.DracoInt8Array();
        try {
            const pointCount = chunk.position.length / 3;
            const faceCount = chunk.index.length / 3;
            addAttribute(module, builder, mesh, module.POSITION, pointCount, 3, chunk.position, "POSITION");
            if (chunk.normal) {
                addAttribute(module, builder, mesh, module.NORMAL, pointCount, 3, chunk.normal, "NORMAL");
            }
            if (chunk.uv) {
                addAttribute(module, builder, mesh, module.TEX_COORD, pointCount, 2, chunk.uv, "TEX_COORD");
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
                encoder.SetAttributeExplicitQuantization(
                    module.TEX_COORD,
                    quant.uvBits,
                    2,
                    quant.uv.origin,
                    quant.uv.range
                );
            }
            encoder.SetSpeedOptions(5, 5);
            encoder.SetEncodingMethod(module.MESH_EDGEBREAKER_ENCODING);
            const length = encoder.EncodeMeshToDracoBuffer(mesh, encoded);
            if (length <= 0) throw new Error("Draco encoding failed");
            const out = new Uint8Array(length);
            for (let i = 0; i < length; i++) out[i] = encoded.GetValue(i) & 0xff;
            return out;
        } finally {
            module.destroy(encoded);
            module.destroy(mesh);
            module.destroy(builder);
            module.destroy(encoder);
        }
    };
}

function addAttribute(module, builder, mesh, attribute, count, components, data, name) {
    if (builder.AddFloatAttributeToMesh(mesh, attribute, count, components, data) === -1) {
        throw new Error(`Draco failed to add ${name}`);
    }
}
