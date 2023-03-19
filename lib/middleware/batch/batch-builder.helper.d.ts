/// <reference types="node" />
import { ChainId, ParsedVaa } from "@certusone/wormhole-sdk";
import { FetchVaaFn } from "../../context";
import { SyntheticBatchVaa } from "./batch.model";
export type VaaId = {
    emitterChain: ParsedVaa["emitterChain"];
    emitterAddress: ParsedVaa["emitterAddress"];
    sequence: ParsedVaa["sequence"];
};
export type SerializedBatchBuilder = {
    vaaBytes: string[];
    vaaIds: VaaId[];
    txHash: string;
};
export declare class SyntheticBatchVaaBuilder {
    txHash: string;
    private vaaIds;
    private fetchVaa;
    vaaBytes: Record<string, Buffer>;
    private readonly fetchedVaas;
    private readonly pendingVaas;
    id: string;
    emitterChain: ChainId;
    constructor(txHash: string, vaaIds: VaaId[], fetchVaa: FetchVaaFn);
    private idToKey;
    fetchPending(): Promise<boolean>;
    addVaaPayload(vaaBytes: Buffer): void;
    /**
     * Adds a vaa payload to the builder. If this vaa was marked as pending, then it's moved to completed.
     * @param vaaBytesArr
     * @private
     */
    private addVaaPayloads;
    get isComplete(): boolean;
    get pctComplete(): number;
    serialize(): SerializedBatchBuilder;
    static deserialize(serialized: SerializedBatchBuilder, fetchVaa: FetchVaaFn): SyntheticBatchVaaBuilder;
    build(): SyntheticBatchVaa;
}
