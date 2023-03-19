import { TypedEvent } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts/abi/commons";
import {
  ChainId,
  ParsedVaa,
  tryUint8ArrayToNative,
} from "@certusone/wormhole-sdk";
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

export async function findLogFromVaa(
  logger: Logger,
  whCoreLayer: IWormhole,
  vaa: ParsedVaa
): Promise<TypedEvent<WormholeCoreLayerLog>> {
  const currentBlock = await whCoreLayer.provider.getBlockNumber();
  const sequence = vaa.sequence.toString();
  const sender = tryUint8ArrayToNative(
    vaa.emitterAddress,
    vaa.emitterChain as ChainId
  );
  const filter = whCoreLayer.filters.LogMessagePublished(sender);
  let log;
  for (let i = 0; !!log || i < 30; ++i) {
    const paginatedLogs = await whCoreLayer.queryFilter(
      filter,
      currentBlock - (i + 1) * 20,
      currentBlock - i * 20
    );
    log = paginatedLogs.find(
      (log) => log.args.sequence.toString() === sequence
    );
  }
  return log;
}
