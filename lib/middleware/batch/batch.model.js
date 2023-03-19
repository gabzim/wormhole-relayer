"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSyntheticBatchVaa = exports.serializeSyntheticBatch = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
function serializeSyntheticBatch({ version, guardianSetIndex, emitterChain, transactionId, vaaBytes, }) {
    if (version !== 2) {
        throw new Error("not a synthetic batch");
    }
    const serializedVaaBytes = vaaBytes.map((buf) => buf.toString("base64"));
    const serializedBatch = Buffer.from(JSON.stringify({
        version,
        emitterChain,
        guardianSetIndex,
        transactionId,
        vaaBytes: serializedVaaBytes,
    }), "utf-8");
    return Buffer.concat([Buffer.from([version]), serializedBatch]);
}
exports.serializeSyntheticBatch = serializeSyntheticBatch;
function parseSyntheticBatchVaa(buffer) {
    const version = buffer.readUint8(0);
    if (version != 2) {
        throw new Error("not a synthetic batch");
    }
    const json = buffer.subarray(1).toString("utf-8");
    const serializedBatch = JSON.parse(json);
    const vaaBytes = serializedBatch.vaaBytes.map((str) => Buffer.from(str, "base64"));
    const vaas = vaaBytes.map((buf) => (0, wormhole_sdk_1.parseVaa)(buf));
    return {
        version,
        emitterChain: serializedBatch.emitterChain,
        guardianSetIndex: serializedBatch.guardianSetIndex,
        transactionId: serializedBatch.transactionId,
        signatures: [],
        hashes: [],
        vaas,
        vaaBytes,
    };
}
exports.parseSyntheticBatchVaa = parseSyntheticBatchVaa;
//# sourceMappingURL=batch.model.js.map