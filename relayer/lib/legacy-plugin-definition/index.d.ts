import * as ethers from "ethers";
import * as solana from "@solana/web3.js";
import { ChainId, EVMChainId, ParsedVaa, SignedVaa } from "@certusone/wormhole-sdk";
import * as winston from "winston";
export interface CommonPluginEnv {
    supportedChains: ChainConfigInfo[];
    wormholeRpc: string;
}
export declare enum EnvType {
    MAINNET = "MAINNET",
    DEVNET = "DEVNET",
    TILT = "TILT",
    LOCALHOST = "LOCALHOST",
    OTHER = "OTHER"
}
export interface ChainConfigInfo {
    chainId: ChainId;
    chainName: string;
    nodeUrl: string;
}
export interface Workflow<D = any> {
    id: WorkflowId;
    pluginName: string;
    scheduledAt?: Date;
    scheduledBy?: string;
    retryCount: number;
    maxRetries?: number;
    data: D;
    failedAt?: Date;
    errorMessage?: string;
    errorStacktrace?: string;
    completedAt?: Date;
    startedProcessingAt?: Date;
    processingBy?: string;
    emitterChain?: number;
    emitterAddress?: string;
    sequence?: string;
}
export interface ActionExecutor {
    <T, W extends Wallet>(action: Action<T, W>): Promise<T>;
    onSolana<T>(f: ActionFunc<T, SolanaWallet>): Promise<T>;
    onEVM<T>(action: Action<T, EVMWallet>): Promise<T>;
}
export declare type ActionFunc<T, W extends Wallet> = (walletToolBox: WalletToolBox<W>, chaidId: ChainId) => Promise<T>;
export interface Action<T, W extends Wallet> {
    chainId: ChainId;
    f: ActionFunc<T, W>;
}
export declare type WorkflowId = string;
export declare type UntypedProvider = {
    rpcUrl: string;
};
export declare type EVMWallet = ethers.Wallet;
export declare type UntypedWallet = UntypedProvider & {
    privateKey: string;
};
export declare type SolanaWallet = {
    conn: solana.Connection;
    payer: solana.Keypair;
};
export declare type Wallet = EVMWallet | SolanaWallet | UntypedWallet;
export interface WalletToolBox<T extends Wallet> extends Providers {
    wallet: T;
}
export interface Providers {
    untyped: Partial<Record<ChainId, UntypedProvider>>;
    evm: Partial<Record<EVMChainId, ethers.providers.Provider>>;
    solana: solana.Connection;
}
export interface ParsedVaaWithBytes extends ParsedVaa {
    bytes: SignedVaa;
}
export declare type EngineInitFn<PluginType extends Plugin> = (engineConfig: CommonPluginEnv, logger: winston.Logger) => PluginType;
export interface WorkflowOptions {
    maxRetries?: number;
}
export interface Plugin<WorkflowData = any> {
    pluginName: string;
    pluginConfig: any;
    shouldSpy: boolean;
    shouldRest: boolean;
    maxRetries?: number;
    afterSetup?(providers: Providers, listenerResources?: {
        eventSource: EventSource;
        db: StagingAreaKeyLock;
    }): Promise<void>;
    getFilters(): ContractFilter[];
    consumeEvent(// Function to be defined in plug-in that takes as input a VAA outputs a list of actions
    vaa: ParsedVaaWithBytes, stagingArea: StagingAreaKeyLock, providers: Providers, extraData?: any[]): Promise<{
        workflowData: WorkflowData;
        workflowOptions?: WorkflowOptions;
    } | undefined>;
    handleWorkflow(workflow: Workflow<WorkflowData>, providers: Providers, execute: ActionExecutor): Promise<void>;
}
export declare type EventSource = (event: SignedVaa, extraData?: any[]) => Promise<void>;
export declare type ContractFilter = {
    emitterAddress: string;
    chainId: ChainId;
    doNotTransform?: boolean;
};
export interface StagingAreaKeyLock {
    withKey<T, KV extends Record<string, any>>(keys: string[], f: (kvs: KV, ctx: OpaqueTx) => Promise<{
        newKV: KV;
        val: T;
    }>, tx?: OpaqueTx): Promise<T>;
    getKeys<KV extends Record<string, any>>(keys: string[]): Promise<KV>;
}
export declare type OpaqueTx = never;