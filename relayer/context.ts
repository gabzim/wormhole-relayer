import { ChainId, ParsedVaa } from "@certusone/wormhole-sdk";
import { Environment, RelayerApp } from "./application";
import { Logger } from "winston";
import { ChainID } from "@certusone/wormhole-spydk/lib/cjs/proto/publicrpc/v1/publicrpc";
import { SyntheticBatchVaa } from "./middleware/batch/batch.model";

export type FetchVaaFn = (
  emitterChain: ChainId | string,
  emitterAddress: Buffer | string,
  sequence: bigint | string,
  retryAttempts?: number,
  retryTimeout?: number
) => Promise<Buffer>;

export interface Context {
  // Vaa
  vaa?: ParsedVaa;
  vaaBytes?: Buffer;
  processVaa: (vaa: Buffer) => Promise<void>;

  // BatchVaas
  batchVaa?: SyntheticBatchVaa;

  // utils & env
  fetchVaa: FetchVaaFn;
  env: Environment;
  logger?: Logger;
  config: {
    spyFilters: {
      emitterFilter?: { chainId?: ChainID; emitterAddress?: string };
    }[];
  };
}
