import { Middleware, Next } from "../compose.middleware";
import { Environment } from "../application";
import { CHAIN_ID_SOLANA, ChainId } from "@certusone/wormhole-sdk";
import { Context } from "../context";
import template from "lodash.template";

export interface ExplorerLinksContext extends Context {
  explorer: {
    linkForTx: (chainId: ChainId, txHash: string) => string;
  }
}

const linksByEnv = {
  [Environment.TESTNET]: {
    [CHAIN_ID_SOLANA]: template("https://solscan.io/tx/<%- txHash %>?cluster=testnet")
  }
}

function linksForTx(env: Environment) {
  // @ts-ignore
  return (chainId: ChainId,txHash: string) => linksByEnv[env][chainId]({txHash});
}

export function explorerLinks(): Middleware<ExplorerLinksContext> {
  return async (ctx: ExplorerLinksContext, next: Next) => {
    ctx.explorer = {
      linkForTx: linksForTx(ctx.env)
    }
    await next();
  };
}
