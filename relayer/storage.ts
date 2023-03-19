import { Job, Queue, Worker } from "bullmq";
import { ParsedVaa, parseVaa } from "@certusone/wormhole-sdk";
import { RelayerApp } from "./application";
import { Context } from "./context";
import { Logger } from "winston";
import {
  Cluster,
  ClusterNode,
  ClusterOptions,
  Redis,
  RedisOptions,
} from "ioredis";
import {
  parseSyntheticBatchVaa,
  SyntheticBatchVaa,
} from "./middleware/batch/batch.model";

function serializeVaa(vaa: ParsedVaa) {
  return {
    sequence: vaa.sequence.toString(),
    hash: vaa.hash.toString("base64"),
    emitterChain: vaa.emitterChain,
    emitterAddress: vaa.emitterAddress.toString("hex"),
    payload: vaa.payload.toString("base64"),
    nonce: vaa.nonce,
    timestamp: vaa.timestamp,
    version: vaa.version,
    guardianSignatures: vaa.guardianSignatures.map((sig) => ({
      signature: sig.signature.toString("base64"),
      index: sig.index,
    })),
    consistencyLevel: vaa.consistencyLevel,
    guardianSetIndex: vaa.guardianSetIndex,
  };
}

function deserializeVaa(vaa: Record<string, any>): ParsedVaa {
  return {
    sequence: BigInt(vaa.sequence),
    hash: Buffer.from(vaa.hash, "base64"),
    emitterChain: vaa.emitterChain,
    emitterAddress: Buffer.from(vaa.emitterAddress, "hex"),
    payload: Buffer.from(vaa.payload, "base64"),
    nonce: vaa.nonce,
    timestamp: vaa.timestamp,
    version: vaa.version,
    guardianSignatures: vaa.guardianSignatures.map((sig: any) => ({
      signature: Buffer.from(sig.signature, "base64"),
      index: sig.index,
    })),
    consistencyLevel: vaa.consistencyLevel,
    guardianSetIndex: vaa.guardianSetIndex,
  };
}

export interface StorageContext extends Context {
  storage: {
    job: Job;
    worker: Worker;
  };
}

export interface StorageOptions {
  redisClusterEndpoints?: ClusterNode[];
  redisCluster?: ClusterOptions;
  redis?: RedisOptions;
  queueName: string;
  attempts: number;
  namespace?: string;
  concurrency?: number;
}

export type JobData = { parsedVaa: any; vaaBytes: string };
export type JobBatchData = { parsedVaas: any[]; vaaBytes: string };

export class Storage<T extends Context> {
  logger: Logger;
  vaaQueue: Queue<JobData, string[], string>;
  batchVaaQueue: Queue<JobBatchData, string[], string>;
  private worker: Worker<JobData, string[], string>;
  private readonly prefix: string;
  private readonly redis: Cluster | Redis;
  private batchWorker: Worker<JobBatchData, string[], string>;

  constructor(private relayer: RelayerApp<T>, private opts: StorageOptions) {
    this.prefix = `{${opts.namespace ?? opts.queueName}}`;
    opts.redis = opts.redis || {};
    opts.redis.maxRetriesPerRequest = null; //Because of: DEPRECATION WARNING! Your redis options maxRetriesPerRequest must be null. On the next versions having this settings will throw an exception
    opts.concurrency = opts.concurrency || 1;
    this.redis = opts.redisClusterEndpoints
      ? new Redis.Cluster(opts.redisClusterEndpoints, opts.redisCluster)
      : new Redis(opts.redis);
    this.vaaQueue = new Queue(opts.queueName, {
      prefix: this.prefix,
      connection: this.redis,
    });
    this.batchVaaQueue = new Queue(opts.queueName + `-batch`, {
      prefix: this.prefix,
      connection: this.redis,
    });
  }

  async addVaaToQueue(vaaBytes: Buffer) {
    const parsedVaa = parseVaa(vaaBytes);
    const id = this.vaaId(parsedVaa);
    const idWithoutHash = id.substring(0, id.length - 6);
    this.logger?.debug(`Adding VAA to queue`, {
      emitterChain: parsedVaa.emitterChain,
      emitterAddress: parsedVaa.emitterAddress.toString("hex"),
      sequence: parsedVaa.sequence.toString(),
    });
    return this.vaaQueue.add(
      idWithoutHash,
      {
        parsedVaa: serializeVaa(parsedVaa),
        vaaBytes: vaaBytes.toString("base64"),
      },
      {
        jobId: id,
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: this.opts.attempts,
      }
    );
  }
  async addBatchVaaToQueue(vaa: Buffer) {
    const batchVaa = parseSyntheticBatchVaa(vaa);
    const lastTxHashDigits = batchVaa.transactionId.substring(
      batchVaa.transactionId.length - 5
    );
    const id = `${batchVaa.emitterChain}-${lastTxHashDigits}`;
    return this.batchVaaQueue.add(
      id,
      {
        parsedVaas: batchVaa.vaas.map(serializeVaa),
        vaaBytes: vaa.toString("base64"),
      },
      {
        jobId: id,
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: this.opts.attempts,
      }
    );
  }

  private vaaId(vaa: ParsedVaa): string {
    const emitterAddress = vaa.emitterAddress.toString("hex");
    const hash = vaa.hash.toString("base64").substring(0, 5);
    let sequence = vaa.sequence.toString();
    return `${vaa.emitterChain}/${emitterAddress}/${sequence}/${hash}`;
  }

  startWorker() {
    const queueName = this.vaaQueue.name;
    this.logger?.debug(
      `Starting worker for queue: ${queueName}. Prefix: ${this.prefix}.`
    );
    this.worker = new Worker(
      queueName,
      async (job) => {
        let parsedVaa = job.data?.parsedVaa;
        if (parsedVaa) {
          this.logger?.debug(`Starting job: ${job.id}`, {
            emitterChain: parsedVaa.emitterChain,
            emitterAddress: parsedVaa.emitterAddress.toString("hex"),
            sequence: parsedVaa.sequence.toString(),
          });
        } else {
          this.logger.debug("Received job with no parsedVaa");
        }
        await job.log(`processing by..${this.worker.id}`);
        let vaaBytes = Buffer.from(job.data.vaaBytes, "base64");
        await this.relayer.pushVaaThroughPipeline(vaaBytes, {
          storage: { job, worker: this.worker },
        });
        await job.updateProgress(100);
        return [""];
      },
      {
        prefix: this.prefix,
        connection: this.redis,
        concurrency: this.opts.concurrency,
      }
    );
  }

  startBatchWorker() {
    const queueName = this.batchVaaQueue.name;
    this.logger?.debug(
      `Starting worker for queue: ${queueName}. Prefix: ${this.prefix}.`
    );
    this.batchWorker = new Worker(
      queueName,
      async (job) => {
        this.logger?.debug(`Starting job: ${job.id} for batch.`);
        await job.log(`processing by..${this.worker.id}`);
        let vaaBytes = Buffer.from(job.data.vaaBytes, "base64");
        await this.relayer.pushVaaThroughPipeline(vaaBytes, {
          storage: { job, worker: this.worker },
        });
        await job.updateProgress(100);
        return [""];
      },
      {
        prefix: this.prefix,
        connection: this.redis,
        concurrency: this.opts.concurrency,
      }
    );
  }

  stopWorker() {
    return this.worker?.close();
  }
}
