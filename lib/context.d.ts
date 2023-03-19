/// <reference types="node" />
import { ChainId, ParsedVaa } from "@certusone/wormhole-sdk";
import { Environment } from "./application";
import { Logger } from "winston";
import { ChainID } from "@certusone/wormhole-spydk/lib/cjs/proto/publicrpc/v1/publicrpc";
import { SyntheticBatchVaa } from "./middleware/batch/batch.model";
export type FetchVaaFn = (emitterChain: ChainId | string, emitterAddress: Buffer | string, sequence: bigint | string, retryAttempts?: number, retryTimeout?: number) => Promise<Buffer>;
export interface Context {
    vaa?: ParsedVaa;
    vaaBytes?: Buffer;
    processVaa: (vaa: Buffer) => Promise<void>;
    batchVaa?: SyntheticBatchVaa;
    fetchVaa: FetchVaaFn;
    env: Environment;
    logger?: Logger;
    config: {
        spyFilters: {
            emitterFilter?: {
                chainId?: ChainID;
                emitterAddress?: string;
            };
        }[];
    };
}
