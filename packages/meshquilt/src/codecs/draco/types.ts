export interface DracoInt8Array {
    GetValue(index: number): number;
}

export interface DracoEncoder {
    SetAttributeExplicitQuantization(
        attribute: number,
        bits: number,
        dimensions: number,
        origin: number[],
        range: number
    ): void;
    SetAttributeQuantization(attribute: number, bits: number): void;
    SetSpeedOptions(encodeSpeed: number, decodeSpeed: number): void;
    SetEncodingMethod(method: number): void;
    EncodeMeshToDracoBuffer(mesh: unknown, encoded: DracoInt8Array): number;
}

export interface DracoMeshBuilder {
    AddFloatAttributeToMesh(
        mesh: unknown,
        attribute: number,
        count: number,
        components: number,
        data: Float32Array
    ): number;
    AddFacesToMesh(mesh: unknown, faceCount: number, indices: Uint32Array): void;
}

export interface DracoEncoderModule {
    POSITION: number;
    NORMAL: number;
    TEX_COORD: number;
    MESH_EDGEBREAKER_ENCODING: number;
    Encoder: new () => DracoEncoder;
    Mesh: new () => unknown;
    MeshBuilder: new () => DracoMeshBuilder;
    DracoInt8Array: new () => DracoInt8Array;
    destroy(object: unknown): void;
}

export interface DracoFloat32Array {
    GetValue(index: number): number;
}

export interface DracoInt32Array {
    GetValue(index: number): number;
}

export type DracoAttribute = object;

export interface DracoMesh {
    num_faces(): number;
    num_points(): number;
}

export interface DracoStatus {
    ok(): boolean;
    error_msg(): string;
}

export interface DracoDecoder {
    GetTrianglesUInt32Array?(mesh: DracoMesh, byteLength: number, pointer: number): boolean | void;
    GetAttributeDataArrayForAllPoints?(
        mesh: DracoMesh,
        attribute: DracoAttribute,
        type: number,
        byteLength: number,
        pointer: number
    ): boolean | void;
    GetEncodedGeometryType(buffer: unknown): number;
    DecodeBufferToMesh(buffer: unknown, mesh: DracoMesh): DracoStatus;
    GetAttributeId(mesh: DracoMesh, attributeType: number): number;
    GetAttribute(mesh: DracoMesh, attributeId: number): DracoAttribute;
    GetAttributeFloatForAllPoints(mesh: DracoMesh, attribute: DracoAttribute, out: DracoFloat32Array): boolean;
    GetFaceFromMesh(mesh: DracoMesh, face: number, out: DracoInt32Array): void;
}

export interface DracoDecoderBuffer {
    Init(data: Uint8Array, length: number): void;
}

export interface DracoDecoderModule {
    /** Optional bulk API; older injected modules use the portable GetValue path. */
    _malloc?(byteLength: number): number;
    _free?(pointer: number): void;
    HEAPU8?: Uint8Array;
    DT_FLOAT32?: number;
    TRIANGULAR_MESH: number;
    POSITION: number;
    NORMAL: number;
    TEX_COORD: number;
    Decoder: new () => DracoDecoder;
    DecoderBuffer: new () => DracoDecoderBuffer;
    Mesh: new () => DracoMesh;
    DracoFloat32Array: new () => DracoFloat32Array;
    DracoInt32Array: new () => DracoInt32Array;
    destroy(object: unknown): void;
}
