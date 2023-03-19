"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreLayerContracts = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const bullmq_1 = require("bullmq");
const ethers_contracts_1 = require("@certusone/wormhole-sdk/lib/cjs/ethers-contracts");
const application_1 = require("../application");
function extractCoreLayerAddressesFromSdk(env) {
    return Object.fromEntries(Object.entries(wormhole_sdk_1.CONTRACTS[env.toUpperCase()]).map(([chainName, addresses]) => [chainName, addresses.core]));
}
const coreLayerAddresses = {
    [application_1.Environment.MAINNET]: extractCoreLayerAddressesFromSdk(application_1.Environment.MAINNET),
    [application_1.Environment.TESTNET]: extractCoreLayerAddressesFromSdk(application_1.Environment.TESTNET),
    [application_1.Environment.DEVNET]: extractCoreLayerAddressesFromSdk(application_1.Environment.DEVNET),
};
function instantiateReadEvmContracts(env, chainRpcs) {
    const evmChainContracts = {};
    for (const [chainIdStr, chainRpc] of Object.entries(chainRpcs)) {
        const chainId = Number(chainIdStr);
        // @ts-ignore
        const address = coreLayerAddresses[env][wormhole_sdk_1.CHAIN_ID_TO_NAME[chainId]];
        const contracts = chainRpc.map((rpc) => ethers_contracts_1.IWormhole__factory.connect(address, rpc));
        evmChainContracts[chainId] = contracts;
    }
    return evmChainContracts;
}
function initializeWormholeObject(env, providers) {
    const evmContracts = instantiateReadEvmContracts(env, providers);
    return {
        addresses: coreLayerAddresses[env],
        contractConstructor: ethers_contracts_1.ITokenBridge__factory.connect,
        contracts: {
            read: {
                evm: evmContracts,
            },
        },
    };
}
function coreLayerContracts() {
    let evmContracts;
    let wormhole;
    return async (ctx, next) => {
        if (!ctx.providers) {
            throw new bullmq_1.UnrecoverableError("You need to first use the providers middleware.");
        }
        if (!evmContracts) {
            ctx.logger?.debug(`Core layer Contracts initializing...`);
            wormhole = initializeWormholeObject(ctx.env, ctx.providers.evm);
            ctx.logger?.debug(`Core layer Contracts initialized`);
        }
        ctx.wormhole = wormhole;
        await next();
    };
}
exports.coreLayerContracts = coreLayerContracts;
//# sourceMappingURL=core-layer.middleware.js.map