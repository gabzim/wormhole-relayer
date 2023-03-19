import { ChainId, ParsedVaa, parseVaa } from "@certusone/wormhole-sdk";
import { FetchVaaFn } from "../../context";
import { SyntheticBatchVaa } from "./batch.model";

export type VaaId = {
  emitterChain: ParsedVaa["emitterChain"];
  emitterAddress: ParsedVaa["emitterAddress"];
  sequence: ParsedVaa["sequence"];
};

export type SerializedBatchBuilder = {
  vaaBytes: string[];
  vaaIds: VaaId[];
  txHash: string;
};

export class SyntheticBatchVaaBuilder {
  public vaaBytes: Record<string, Buffer>;
  private readonly fetchedVaas: Record<string, ParsedVaa>;
  private readonly pendingVaas: Record<string, VaaId>;
  public id: string;
  public emitterChain: ChainId;
  constructor(
    public txHash: string,
    private vaaIds: VaaId[],
    private fetchVaa: FetchVaaFn
  ) {
    this.id = txHash;

    this.pendingVaas = {};
    for (const id of vaaIds) {
      this.pendingVaas[this.idToKey(id)] = id;
    }
    this.fetchedVaas = {};
    this.vaaBytes = {};
  }

  private idToKey = (id: VaaId) =>
    `${id.emitterChain}/${id.emitterAddress.toString(
      "hex"
    )}/${id.sequence.toString()}`;

  // returns true if all remaining vaas have been fetched, false otherwise
  async fetchPending(): Promise<boolean> {
    if (!Object.keys(this.pendingVaas).length) {
      return true;
    }
    const fetched = await Promise.all(
      Object.values(this.pendingVaas).map(
        async ({ emitterChain, emitterAddress, sequence }) => {
          try {
            return await this.fetchVaa(
              emitterChain as ChainId,
              emitterAddress,
              sequence
            );
          } catch (e) {
            return null;
          }
        }
      )
    );

    const vaas = fetched.filter((vaa) => vaa !== null && vaa.length > 0);
    this.addVaaPayloads(vaas);
    return !Object.keys(this.pendingVaas).length;
  }

  addVaaPayload(vaaBytes: Buffer) {
    const parsedVaa = parseVaa(vaaBytes);
    const key = this.idToKey(parsedVaa);
    delete this.pendingVaas[key];
    this.fetchedVaas[key] = parsedVaa;
    this.vaaBytes[key] = vaaBytes;
  }

  /**
   * Adds a vaa payload to the builder. If this vaa was marked as pending, then it's moved to completed.
   * @param vaaBytesArr
   * @private
   */
  private addVaaPayloads(vaaBytesArr: Buffer[]) {
    for (const vaaBytes of vaaBytesArr) {
      this.addVaaPayload(vaaBytes);
    }
  }

  get isComplete() {
    const pendingCount = Object.keys(this.pendingVaas).length;
    return pendingCount === 0;
  }

  get pctComplete() {
    const fetchedCount = Object.keys(this.fetchedVaas).length;
    const pendingCount = Object.keys(this.pendingVaas).length;
    return Math.floor(fetchedCount / (fetchedCount + pendingCount)) * 100;
  }

  serialize(): SerializedBatchBuilder {
    return {
      vaaBytes: Object.values(this.vaaBytes).map((buffer) =>
        buffer.toString("base64")
      ),
      vaaIds: this.vaaIds,
      txHash: this.txHash,
    };
  }

  static deserialize(
    serialized: SerializedBatchBuilder,
    fetchVaa: FetchVaaFn
  ): SyntheticBatchVaaBuilder {
    const vaaBytes = serialized.vaaBytes.map((str) =>
      Buffer.from(str, "base64")
    );
    const builder = new SyntheticBatchVaaBuilder(
      serialized.txHash,
      serialized.vaaIds,
      fetchVaa
    );
    builder.addVaaPayloads(vaaBytes);
    return builder;
  }

  build(): SyntheticBatchVaa {
    const vaas = Object.values(this.fetchedVaas);
    const vaaBytes = Object.values(this.vaaBytes);
    return {
      version: 2,
      emitterChain: vaas[0].emitterChain,
      guardianSetIndex: vaas[0].guardianSetIndex,
      signatures: [], //forward compatibility ? is this important in light of: https://github.com/wormhole-foundation/wormhole/issues/2483
      hashes: [], // forward compatibility
      transactionId: this.txHash,
      vaas,
      vaaBytes,
    };
  }
}
