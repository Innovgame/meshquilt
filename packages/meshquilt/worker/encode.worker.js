// Generated from src/runtime/worker.ts. Run pnpm --filter meshquilt build; do not edit.
"use strict";
(() => {
  // src/types.ts
  var MeshQuiltError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "MeshQuiltError";
    }
  };

  // src/codecs/draco/encode-chunk.ts
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

  // src/quantization/quant.ts
  var DEFAULT_POSITION_BITS = 14;
  var DEFAULT_NORMAL_BITS = 8;
  var DEFAULT_UV_BITS = 10;
  var DEFAULT_MAX_TRIANGLES = 1e5;
  var MAX_QUANT_BITS = 30;
  function computeVolume(values, stride) {
    if (!Number.isInteger(stride) || stride < 1) throw new MeshQuiltError("stride must be an integer >= 1");
    if (values.length % stride !== 0) {
      throw new MeshQuiltError(`attribute length ${values.length} is not divisible by ${stride}`);
    }
    const origin = new Array(stride).fill(Number.POSITIVE_INFINITY);
    const max = new Array(stride).fill(Number.NEGATIVE_INFINITY);
    if (values.length === 0) {
      return { origin: new Array(stride).fill(0), range: 1 };
    }
    for (let i = 0; i < values.length; i += stride) {
      for (let c = 0; c < stride; c++) {
        const value = values[i + c];
        if (!Number.isFinite(value)) throw new MeshQuiltError("attribute values must be finite");
        if (value < origin[c]) origin[c] = value;
        if (value > max[c]) max[c] = value;
      }
    }
    let range = 0;
    for (let c = 0; c < stride; c++) {
      const span = max[c] - origin[c];
      if (span > range) range = span;
    }
    return normalizeVolume({ origin, range: range === 0 ? 1 : range }, stride);
  }
  function normalizeVolume(volume, dimensions) {
    if (volume.origin.length !== dimensions)
      throw new MeshQuiltError(`volume origin must have ${dimensions} components`);
    const origin = Array.from(volume.origin, Math.fround);
    const range = Math.fround(volume.range);
    if (!origin.every(Number.isFinite) || !Number.isFinite(range) || range <= 0) {
      throw new MeshQuiltError("volume must have finite float32 origins and a positive finite float32 range");
    }
    return { origin, range };
  }
  function validateQuantization(quant) {
    assertBits("positionBits", quant.positionBits);
    assertBits("normalBits", quant.normalBits);
    assertBits("uvBits", quant.uvBits);
    normalizeVolume(quant.position, 3);
    if (quant.uv) normalizeVolume(quant.uv, 2);
  }
  function assertBits(name, bits) {
    if (!Number.isInteger(bits) || bits < 0 || bits > MAX_QUANT_BITS) {
      throw new MeshQuiltError(`${name} must be an integer from 0 to ${MAX_QUANT_BITS}`);
    }
  }
  function resolveQuantBits(bits) {
    const positionBits = bits.positionBits ?? DEFAULT_POSITION_BITS;
    const normalBits = bits.normalBits ?? DEFAULT_NORMAL_BITS;
    const uvBits = bits.uvBits ?? DEFAULT_UV_BITS;
    assertBits("positionBits", positionBits);
    assertBits("normalBits", normalBits);
    assertBits("uvBits", uvBits);
    return { positionBits, normalBits, uvBits };
  }

  // src/container/container.ts
  var QUILT_VERSION = 1;
  var HEADER_BYTES = 44;
  var FLAG_NORMAL = 1;
  var FLAG_UV = 2;
  function encodeContainer(header, chunks) {
    if (header.version !== QUILT_VERSION) throw new MeshQuiltError(`unsupported version ${header.version}`);
    if (chunks.length !== header.chunkCount) {
      throw new MeshQuiltError(`header chunkCount ${header.chunkCount} does not match ${chunks.length} buffers`);
    }
    if (!Number.isInteger(header.chunkCount) || header.chunkCount < 1 || header.chunkCount > 4294967295) {
      throw new MeshQuiltError("chunkCount must be an integer from 1 to 4294967295");
    }
    validateQuantization(header.quantization);
    if (header.hasUv && !header.quantization.uv) throw new MeshQuiltError("UV quantization volume is missing");
    let size = HEADER_BYTES;
    for (const chunk of chunks) {
      if (chunk.byteLength > 4294967295) throw new MeshQuiltError("chunk exceeds uint32 byte length");
      size += 4 + chunk.byteLength;
    }
    if (!Number.isSafeInteger(size)) throw new MeshQuiltError("container byte length exceeds safe integer range");
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    bytes.set([77, 81, 76, 84], 0);
    view.setUint16(4, QUILT_VERSION, true);
    let flags = 0;
    if (header.hasNormal) flags |= FLAG_NORMAL;
    if (header.hasUv) flags |= FLAG_UV;
    view.setUint16(6, flags, true);
    view.setUint32(8, header.chunkCount, true);
    bytes[12] = header.quantization.positionBits;
    bytes[13] = header.quantization.normalBits;
    bytes[14] = header.quantization.uvBits;
    writeVolume(view, 16, header.quantization.position, 3);
    writeVolume(view, 32, header.quantization.uv ?? { origin: [0, 0], range: 0 }, 2);
    let offset = HEADER_BYTES;
    for (const chunk of chunks) {
      view.setUint32(offset, chunk.byteLength, true);
      offset += 4;
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
  function writeVolume(view, offset, volume, dims) {
    for (let i = 0; i < dims; i++) view.setFloat32(offset + i * 4, volume.origin[i] ?? 0, true);
    view.setFloat32(offset + dims * 4, volume.range, true);
  }

  // src/geometry/validate.ts
  function validateGeometryShape(geometry) {
    if (geometry.position.length === 0 || geometry.position.length % 3 !== 0) {
      throw new MeshQuiltError("position must be a non-empty xyz float array");
    }
    if (geometry.index && (geometry.index.length === 0 || geometry.index.length % 3 !== 0)) {
      throw new MeshQuiltError("index must be a non-empty triangle list");
    }
    const vertexCount = geometry.position.length / 3;
    if (!geometry.index && vertexCount % 3 !== 0)
      throw new MeshQuiltError("nonindexed positions must form complete triangles");
    if (geometry.normal && geometry.normal.length !== geometry.position.length) {
      throw new MeshQuiltError("normal length must match position length");
    }
    if (geometry.uv && geometry.uv.length !== vertexCount * 2) {
      throw new MeshQuiltError("uv length must be twice the vertex count");
    }
  }
  function validateIndices(geometry) {
    const indices = geometry.index;
    if (!indices) return;
    const vertexCount = geometry.position.length / 3;
    for (let i = 0; i < indices.length; i++) {
      const vertex = indices[i];
      if (vertex < 0 || vertex >= vertexCount) {
        throw new MeshQuiltError(`index ${vertex} is outside 0..${vertexCount - 1}`);
      }
    }
  }
  function validateFiniteAttribute(name, values) {
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) throw new MeshQuiltError(`${name} values must be finite`);
    }
  }

  // src/geometry/split.ts
  function* iterateValidatedGeometry(geometry, maxTriangles) {
    const indexCount = geometry.index?.length ?? geometry.position.length / 3;
    const triangleCount = indexCount / 3;
    if (triangleCount <= maxTriangles) {
      if (isNormalized(geometry)) yield geometry;
      else
        yield {
          ...geometry,
          index: geometry.index ? new Uint32Array(geometry.index) : sequentialIndex(indexCount)
        };
      return;
    }
    if (!geometry.index) {
      for (let start = 0; start < indexCount; start += maxTriangles * 3) {
        const end = Math.min(start + maxTriangles * 3, indexCount);
        const chunk = {
          position: geometry.position.slice(start * 3, end * 3),
          index: sequentialIndex(end - start)
        };
        if (geometry.normal) chunk.normal = geometry.normal.slice(start * 3, end * 3);
        if (geometry.uv) chunk.uv = geometry.uv.slice(start * 2, end * 2);
        yield chunk;
      }
      return;
    }
    const vertexCount = geometry.position.length / 3;
    const dense = vertexCount <= maxTriangles * 6 ? new Uint32Array(vertexCount) : void 0;
    const touched = dense ? new Uint32Array(Math.min(vertexCount, maxTriangles * 3)) : void 0;
    const vertexMap = dense ? void 0 : /* @__PURE__ */ new Map();
    const positions = new Float32Array(maxTriangles * 9);
    const indices = new Uint32Array(maxTriangles * 3);
    const normals = geometry.normal ? new Float32Array(maxTriangles * 9) : void 0;
    const uvs = geometry.uv ? new Float32Array(maxTriangles * 6) : void 0;
    let localVertices = 0;
    let localTriangles = 0;
    const flush = () => {
      const chunk = {
        position: positions.slice(0, localVertices * 3),
        index: indices.slice(0, localTriangles * 3)
      };
      if (normals && geometry.normal) chunk.normal = normals.slice(0, localVertices * 3);
      if (uvs && geometry.uv) chunk.uv = uvs.slice(0, localVertices * 2);
      if (dense && touched) {
        for (let i = 0; i < localVertices; i++) dense[touched[i]] = 0;
      } else vertexMap.clear();
      localVertices = 0;
      localTriangles = 0;
      return chunk;
    };
    for (let i = 0; i < indexCount; i += 3) {
      for (let corner = 0; corner < 3; corner++) {
        const source = geometry.index[i + corner];
        let local = dense ? dense[source] ? dense[source] - 1 : void 0 : vertexMap.get(source);
        if (local === void 0) {
          local = localVertices++;
          if (dense && touched) {
            dense[source] = local + 1;
            touched[local] = source;
          } else vertexMap.set(source, local);
          const src = source * 3;
          const dst = local * 3;
          positions[dst] = geometry.position[src];
          positions[dst + 1] = geometry.position[src + 1];
          positions[dst + 2] = geometry.position[src + 2];
          if (normals && geometry.normal) {
            normals[dst] = geometry.normal[src];
            normals[dst + 1] = geometry.normal[src + 1];
            normals[dst + 2] = geometry.normal[src + 2];
          }
          if (uvs && geometry.uv) {
            uvs[local * 2] = geometry.uv[source * 2];
            uvs[local * 2 + 1] = geometry.uv[source * 2 + 1];
          }
        }
        indices[localTriangles * 3 + corner] = local;
      }
      localTriangles++;
      if (localTriangles >= maxTriangles) yield flush();
    }
    if (localTriangles > 0) yield flush();
  }
  function sequentialIndex(count) {
    const index = new Uint32Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    return index;
  }
  function isNormalized(geometry) {
    return geometry.index instanceof Uint32Array;
  }

  // src/geometry/prepare.ts
  function prepareGeometry(geometry, options = {}) {
    validateGeometryShape(geometry);
    const bits = resolveQuantBits(options);
    const position = options.positionVolume ? normalizeVolume(options.positionVolume, 3) : void 0;
    const uv = options.uvVolume ? normalizeVolume(options.uvVolume, 2) : void 0;
    validateIndices(geometry);
    if (geometry.normal) validateFiniteAttribute("normal", geometry.normal);
    if (position) validateFiniteAttribute("position", geometry.position);
    if (geometry.uv && uv) validateFiniteAttribute("uv", geometry.uv);
    const quant = {
      ...bits,
      position: position ?? computeVolume(geometry.position, 3)
    };
    if (uv) quant.uv = uv;
    else if (geometry.uv) quant.uv = computeVolume(geometry.uv, 2);
    return quant;
  }

  // src/pipeline.ts
  async function encodeGeometry(geometry, options) {
    if (options.signal?.aborted) throw new MeshQuiltError("operation aborted");
    const maxTriangles = options.maxTriangles ?? DEFAULT_MAX_TRIANGLES;
    if (!Number.isInteger(maxTriangles) || maxTriangles < 1)
      throw new MeshQuiltError("maxTriangles must be an integer >= 1");
    const concurrency = options.concurrency ?? 1;
    if (!Number.isInteger(concurrency) || concurrency < 1)
      throw new MeshQuiltError("concurrency must be an integer >= 1");
    const quant = prepareGeometry(geometry, options);
    const totalChunks = Math.ceil((geometry.index?.length ?? geometry.position.length / 3) / 3 / maxTriangles);
    let completedChunks = 0;
    const report = () => options.onProgress?.({ stage: "encode", completedChunks, totalChunks });
    report();
    const pieces = iterateValidatedGeometry(geometry, maxTriangles);
    const encoded = await mapPool(
      pieces,
      concurrency,
      async (chunk, index) => {
        const bytes = await options.encodeChunk(chunk, quant, index);
        completedChunks++;
        report();
        return bytes;
      },
      { signal: options.signal }
    );
    const header = {
      version: 1,
      hasNormal: geometry.normal !== void 0,
      hasUv: geometry.uv !== void 0,
      chunkCount: encoded.length,
      quantization: quant
    };
    return encodeContainer(header, encoded);
  }
  async function mapPool(items, concurrency, fn, options = {}) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new MeshQuiltError("concurrency must be an integer >= 1");
    }
    const results = [];
    const iterator = items[Symbol.iterator]();
    let next = 0;
    const lanes = Array.isArray(items) ? Math.min(concurrency, items.length) : concurrency;
    let failed = false;
    let failure;
    await Promise.all(
      Array.from({ length: lanes }, async () => {
        while (!failed) {
          try {
            if (options.signal?.aborted) throw new MeshQuiltError("operation aborted");
            const item = iterator.next();
            if (item.done) break;
            const index = next++;
            results[index] = await fn(item.value, index);
          } catch (error) {
            if (!failed) failure = error;
            failed = true;
          }
        }
      })
    );
    if (failed) {
      iterator.return?.();
      throw failure;
    }
    if (options.signal?.aborted) throw new MeshQuiltError("operation aborted");
    return results;
  }

  // src/runtime/worker.ts
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
    if (data.type !== "encode" && data.type !== "encodeGeometry") return;
    try {
      if (!encodeChunk) throw new Error("worker is not initialized");
      const bytes = data.type === "encode" ? encodeChunk(data.chunk, data.quant) : await encodeGeometry(data.geometry, {
        ...data.options,
        encodeChunk,
        onProgress(progress) {
          scope.postMessage({ type: "progress", id: data.id, progress });
        }
      });
      scope.postMessage({ id: data.id, buffer: bytes.buffer }, [bytes.buffer]);
    } catch (error) {
      scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
    }
  };
})();
