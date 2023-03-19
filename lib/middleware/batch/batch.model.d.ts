/// <reference types="node" />
import { GuardianSignature, ParsedVaa } from "@certusone/wormhole-sdk";
export type SyntheticBatchVaa = {
    version: 2;
    guardianSetIndex: number;
    signatures: GuardianSignature[];
    emitterChain: number;
    transactionId: string;
    hashes: string[];
    vaas: ParsedVaa[];
    vaaBytes: Buffer[];
};
export declare function serializeSyntheticBatch({ version, guardianSetIndex, emitterChain, transactionId, vaaBytes, }: SyntheticBatchVaa): Buffer;
export declare function parseSyntheticBatchVaa(buffer: Buffer): SyntheticBatchVaa;
