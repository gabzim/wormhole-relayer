"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyntheticBatchVaaBuilder = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
class SyntheticBatchVaaBuilder {
    txHash;
    vaaIds;
    fetchVaa;
    vaaBytes;
    fetchedVaas;
    pendingVaas;
    id;
    emitterChain;
    constructor(txHash, vaaIds, fetchVaa) {
        this.txHash = txHash;
        this.vaaIds = vaaIds;
        this.fetchVaa = fetchVaa;
        this.id = txHash;
        this.pendingVaas = {};
        for (const id of vaaIds) {
            this.pendingVaas[this.idToKey(id)] = id;
        }
        this.fetchedVaas = {};
        this.vaaBytes = {};
    }
    idToKey = (id) => `${id.emitterChain}/${id.emitterAddress.toString("hex")}/${id.sequence.toString()}`;
    // returns true if all remaining vaas have been fetched, false otherwise
    async fetchPending() {
        if (!Object.keys(this.pendingVaas).length) {
            return true;
        }
        const fetched = await Promise.all(Object.values(this.pendingVaas).map(async ({ emitterChain, emitterAddress, sequence }) => {
            try {
                return await this.fetchVaa(emitterChain, emitterAddress, sequence);
            }
            catch (e) {
                return null;
            }
        }));
        const vaas = fetched.filter((vaa) => vaa !== null && vaa.length > 0);
        this.addVaaPayloads(vaas);
        return !Object.keys(this.pendingVaas).length;
    }
    addVaaPayload(vaaBytes) {
        const parsedVaa = (0, wormhole_sdk_1.parseVaa)(vaaBytes);
        const key = this.idToKey(parsedVaa);
        delete this.pendingVaas[key];
        this.fetchedVaas[key] = parsedVaa;
        this.vaaBytes[key] = vaaBytes;
    }
    /**
     * Adds a vaa payload to the builder. If this vaa was marked as pending, then it's moved to completed.
     * @param vaaBytesArr
     * @private
     */
    addVaaPayloads(vaaBytesArr) {
        for (const vaaBytes of vaaBytesArr) {
            this.addVaaPayload(vaaBytes);
        }
    }
    get isComplete() {
        const pendingCount = Object.keys(this.pendingVaas).length;
        return pendingCount === 0;
    }
    get pctComplete() {
        const fetchedCount = Object.keys(this.fetchedVaas).length;
        const pendingCount = Object.keys(this.pendingVaas).length;
        return Math.floor(fetchedCount / (fetchedCount + pendingCount)) * 100;
    }
    serialize() {
        return {
            vaaBytes: Object.values(this.vaaBytes).map((buffer) => buffer.toString("base64")),
            vaaIds: this.vaaIds,
            txHash: this.txHash,
        };
    }
    static deserialize(serialized, fetchVaa) {
        const vaaBytes = serialized.vaaBytes.map((str) => Buffer.from(str, "base64"));
        const builder = new SyntheticBatchVaaBuilder(serialized.txHash, serialized.vaaIds, fetchVaa);
        builder.addVaaPayloads(vaaBytes);
        return builder;
    }
    build() {
        const vaas = Object.values(this.fetchedVaas);
        const vaaBytes = Object.values(this.vaaBytes);
        return {
            version: 2,
            emitterChain: vaas[0].emitterChain,
            guardianSetIndex: vaas[0].guardianSetIndex,
            signatures: [],
            hashes: [],
            transactionId: this.txHash,
            vaas,
            vaaBytes,
        };
    }
}
exports.SyntheticBatchVaaBuilder = SyntheticBatchVaaBuilder;
//# sourceMappingURL=batch-builder.helper.js.map