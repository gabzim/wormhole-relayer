import { Environment, RelayerApp, RelayerAppOpts } from "./application";
import { LoggingContext } from "./middleware/logger.middleware";
import { ProvidersOpts } from "./middleware/providers.middleware";
import { WalletContext } from "./middleware/wallet/wallet.middleware";
import { TokenBridgeContext } from "./middleware/token-bridge.middleware";
import { StagingAreaContext } from "./middleware/staging-area.middleware";
import { Logger } from "winston";
import { StorageContext } from "./storage";
import { ChainId } from "@certusone/wormhole-sdk";
import { ClusterNode, ClusterOptions, RedisOptions } from "ioredis";
import { SourceTxContext } from "./middleware/source-tx.middleware";
export interface StandardRelayerAppOpts extends RelayerAppOpts {
    name: string;
    spyEndpoint?: string;
    logger?: Logger;
    privateKeys?: Partial<{
        [k in ChainId]: any[];
    }>;
    workflows?: {
        retries: number;
    };
    providers?: ProvidersOpts;
    redisClusterEndpoints?: ClusterNode[];
    redisCluster?: ClusterOptions;
    redis?: RedisOptions;
    fetchSourceTxhash?: boolean;
}
export type StandardRelayerContext = LoggingContext & StorageContext & TokenBridgeContext & StagingAreaContext & WalletContext & SourceTxContext;
export declare class StandardRelayerApp<ContextT extends StandardRelayerContext = StandardRelayerContext> extends RelayerApp<ContextT> {
    constructor(env: Environment, opts: StandardRelayerAppOpts);
}
