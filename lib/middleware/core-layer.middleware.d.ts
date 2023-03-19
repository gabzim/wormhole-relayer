import { Middleware } from "../compose.middleware";
import { ChainName, EVMChainId } from "@certusone/wormhole-sdk";
import { ethers, Signer } from "ethers";
import { ProviderContext } from "./providers.middleware";
import { ITokenBridge, IWormhole } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
export type Wormhole = {
    addresses: {
        [k in ChainName]?: string;
    };
    contractConstructor: (address: string, signerOrProvider: Signer | ethers.providers.Provider) => ITokenBridge;
    contracts: {
        read: {
            evm: {
                [k in EVMChainId]?: IWormhole[];
            };
        };
    };
};
export interface CoreLayerContext extends ProviderContext {
    wormhole: Wormhole;
}
export declare function coreLayerContracts(): Middleware<CoreLayerContext>;
