import { Middleware } from "../compose.middleware";
import { CoreLayerContext } from "./core-layer.middleware";
import { ClusterNode, ClusterOptions, RedisOptions } from "ioredis";
import { RelayerApp } from "../application";
import { SourceTxContext } from "./source-tx.middleware";
interface BatchVaaContext extends CoreLayerContext, SourceTxContext {
    batch: {};
}
export interface BatchVaaOpts {
    redisClusterEndpoints?: ClusterNode[];
    redisCluster?: ClusterOptions;
    redis?: RedisOptions;
    namespace?: string;
}
export declare function batchVaas(app: RelayerApp<any>, opts: BatchVaaOpts): Middleware<BatchVaaContext>;
export {};
