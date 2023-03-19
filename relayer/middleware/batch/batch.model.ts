import {
  ChainId,
  GuardianSignature,
  ParsedVaa,
  parseVaa,
} from "@certusone/wormhole-sdk";

// From Go source
// BatchVAA struct {
//   // Version of the VAA schema
//   Version uint8
//   // GuardianSetIndex is the index of the guardian set that signed this VAA
//   GuardianSetIndex uint32
//   // SignatureData is the signature of the guardian set
//   Signatures []*Signature
//
//   // EmitterChain the VAAs were emitted on
//   EmitterChain ChainID
//
//   // The chain-native identifier of the transaction that created the batch VAA.
//   TransactionID common.Hash
//
//   // array of Observation VAA hashes
//   Hashes []common.Hash
//
//   // Observations in the batch
//   Observations []*Observation
// }

export type SyntheticBatchVaa = {
  version: 2;
  guardianSetIndex: number;
  signatures: GuardianSignature[];
  emitterChain: number;
  transactionId: string;
  hashes: string[];

  // non standard fields because we're dealing with synthetic batches and not headless vaas.
  vaas: ParsedVaa[];
  vaaBytes: Buffer[];
};

export function serializeSyntheticBatch({
  version,
  guardianSetIndex,
  emitterChain,
  transactionId,
  vaaBytes,
}: SyntheticBatchVaa): Buffer {
  if (version !== 2) {
    throw new Error("not a synthetic batch");
  }
  const serializedVaaBytes = vaaBytes.map((buf) => buf.toString("base64"));
  const serializedBatch = Buffer.from(
    JSON.stringify({
      version,
      emitterChain,
      guardianSetIndex,
      transactionId,
      vaaBytes: serializedVaaBytes,
    }),
    "utf-8"
  );
  return Buffer.concat([Buffer.from([version]), serializedBatch]);
}

export function parseSyntheticBatchVaa(buffer: Buffer): SyntheticBatchVaa {
  const version = buffer.readUint8(0);
  if (version != 2) {
    throw new Error("not a synthetic batch");
  }
  const json = buffer.subarray(1).toString("utf-8");
  const serializedBatch = JSON.parse(json);
  const vaaBytes = serializedBatch.vaaBytes.map((str: string) =>
    Buffer.from(str, "base64")
  );
  const vaas = vaaBytes.map((buf: Buffer) => parseVaa(buf));
  return {
    version,
    emitterChain: serializedBatch.emitterChain,
    guardianSetIndex: serializedBatch.guardianSetIndex,
    transactionId: serializedBatch.transactionId,
    signatures: <GuardianSignature[]>[],
    hashes: <string[]>[],
    vaas,
    vaaBytes,
  };
}
