/// <reference lib="dom" />
import { Middleware } from "../compose.middleware";
import { Context } from "../context";
import { Environment } from "../application";
import { sleep } from "../utils";

export interface SourceTxOpts {
  wormscanEndpoint: string;
  retries: 3;
}

export interface SourceTxContext extends Context {
  sourceTxHash?: string;
}

const defaultOptsByEnv = {
  [Environment.MAINNET]: {
    wormscanEndpoint: "https://api.wormscan.io",
    retries: 5,
  },
  [Environment.TESTNET]: {
    wormscanEndpoint: "https://api.testnet.wormscan.io",
    retries: 5,
  },
  [Environment.DEVNET]: {
    wormscanEndpoint: "",
    retries: 5,
  },
};

export function sourceTx(
  optsWithoutDefaults?: SourceTxOpts
): Middleware<SourceTxContext> {
  let opts: SourceTxOpts;
  return async (ctx, next) => {
    if (!opts) {
      opts = Object.assign({}, defaultOptsByEnv[ctx.env], optsWithoutDefaults);
    }
    if (!ctx.vaa) {
      ctx.sourceTxHash = ctx.batchVaa?.transactionId;
      await next();
      return;
    }

    const { emitterChain, emitterAddress, sequence } = ctx.vaa;
    let attempt = 0;
    let txHash = "";
    do {
      try {
        txHash = await fetchVaaHash(
          opts.wormscanEndpoint,
          emitterChain,
          emitterAddress,
          sequence
        );
      } catch (e) {
        ctx.logger?.error(
          `could not obtain txHash, attempt: ${attempt} of ${opts.retries}.`,
          e
        );
        await sleep(attempt * 100); // linear wait
      }
    } while (attempt < opts.retries && txHash === "");
    ctx.sourceTxHash = txHash;
    await next();
  };
}

async function fetchVaaHash(
  baseEndpoint: string,
  emitterChain: number,
  emitterAddress: Buffer,
  sequence: bigint
) {
  const res = await fetch(
    `${baseEndpoint}/api/v1/vaas/${emitterChain}/${emitterAddress.toString(
      "hex"
    )}/${sequence.toString()}`
  );
  if (res.status === 404) {
    throw new Error("Not found yet.");
  } else if (res.status > 500) {
    throw new Error(`Got: ${res.status}`);
  }
  return (await res.json()).data?.txHash;
}
