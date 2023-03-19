import { TypedEvent } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts/abi/commons";
import { ParsedVaa } from "@certusone/wormhole-sdk";
import { IWormhole } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { Logger } from "winston";
import { BigNumber } from "ethers";
type WormholeCoreLayerLog = [string, BigNumber, number, string, number] & {
    sender: string;
    sequence: BigNumber;
    nonce: number;
    payload: string;
    consistencyLevel: number;
};
export declare function findLogFromVaa(logger: Logger, whCoreLayer: IWormhole, vaa: ParsedVaa): Promise<TypedEvent<WormholeCoreLayerLog>>;
export {};
