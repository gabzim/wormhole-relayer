import { Middleware } from "../compose.middleware";
import {
  CHAIN_ID_TO_NAME,
  ChainId,
  ChainName,
  CONTRACTS,
  EVMChainId,
  ParsedTokenTransferVaa,
  ParsedVaa,
  parseTokenTransferVaa,
} from "@certusone/wormhole-sdk";
import { ethers, providers, Signer } from "ethers";
import { ProviderContext } from "./providers.middleware";
import { UnrecoverableError } from "bullmq";
import {
  ITokenBridge,
  ITokenBridge__factory,
  IWormhole,
  IWormhole__factory,
} from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { Environment } from "../application";
import { encodeEmitterAddress } from "../utils";

function extractCoreLayerAddressesFromSdk(env: Environment) {
  return Object.fromEntries(
    Object.entries((CONTRACTS as any)[env.toUpperCase()]).map(
      ([chainName, addresses]: any[]) => [chainName, addresses.core]
    )
  );
}

const coreLayerAddresses = {
  [Environment.MAINNET]: extractCoreLayerAddressesFromSdk(Environment.MAINNET),
  [Environment.TESTNET]: extractCoreLayerAddressesFromSdk(Environment.TESTNET),
  [Environment.DEVNET]: extractCoreLayerAddressesFromSdk(Environment.DEVNET),
};

export type Wormhole = {
  addresses: {
    [k in ChainName]?: string;
  };
  contractConstructor: (
    address: string,
    signerOrProvider: Signer | ethers.providers.Provider
  ) => ITokenBridge;
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

function instantiateReadEvmContracts(
  env: Environment,
  chainRpcs: Partial<Record<EVMChainId, ethers.providers.JsonRpcProvider[]>>
) {
  const evmChainContracts: Partial<{
    [k in EVMChainId]: IWormhole[];
  }> = {};
  for (const [chainIdStr, chainRpc] of Object.entries(chainRpcs)) {
    const chainId = Number(chainIdStr) as EVMChainId;
    // @ts-ignore
    const address = coreLayerAddresses[env][CHAIN_ID_TO_NAME[chainId]];
    const contracts = chainRpc.map((rpc) =>
      IWormhole__factory.connect(address, rpc)
    );
    evmChainContracts[chainId] = contracts;
  }
  return evmChainContracts;
}

function initializeWormholeObject(
  env: Environment,
  providers: Partial<Record<EVMChainId, ethers.providers.JsonRpcProvider[]>>
): Wormhole {
  const evmContracts = instantiateReadEvmContracts(env, providers);
  return {
    addresses: coreLayerAddresses[env],
    contractConstructor: ITokenBridge__factory.connect,
    contracts: {
      read: {
        evm: evmContracts,
      },
    },
  };
}

export function coreLayerContracts(): Middleware<CoreLayerContext> {
  let evmContracts: Partial<{ [k in EVMChainId]: IWormhole[] }>;
  let wormhole: Wormhole;
  return async (ctx: CoreLayerContext, next) => {
    if (!ctx.providers) {
      throw new UnrecoverableError(
        "You need to first use the providers middleware."
      );
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
