"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Storage = void 0;
const bullmq_1 = require("bullmq");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const ioredis_1 = require("ioredis");
const batch_model_1 = require("./middleware/batch/batch.model");
function serializeVaa(vaa) {
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
function deserializeVaa(vaa) {
    return {
        sequence: BigInt(vaa.sequence),
        hash: Buffer.from(vaa.hash, "base64"),
        emitterChain: vaa.emitterChain,
        emitterAddress: Buffer.from(vaa.emitterAddress, "hex"),
        payload: Buffer.from(vaa.payload, "base64"),
        nonce: vaa.nonce,
        timestamp: vaa.timestamp,
        version: vaa.version,
        guardianSignatures: vaa.guardianSignatures.map((sig) => ({
            signature: Buffer.from(sig.signature, "base64"),
            index: sig.index,
        })),
        consistencyLevel: vaa.consistencyLevel,
        guardianSetIndex: vaa.guardianSetIndex,
    };
}
class Storage {
    relayer;
    opts;
    logger;
    vaaQueue;
    batchVaaQueue;
    worker;
    prefix;
    redis;
    batchWorker;
    constructor(relayer, opts) {
        this.relayer = relayer;
        this.opts = opts;
        this.prefix = `{${opts.namespace ?? opts.queueName}}`;
        opts.redis = opts.redis || {};
        opts.redis.maxRetriesPerRequest = null; //Because of: DEPRECATION WARNING! Your redis options maxRetriesPerRequest must be null. On the next versions having this settings will throw an exception
        opts.concurrency = opts.concurrency || 1;
        this.redis = opts.redisClusterEndpoints
            ? new ioredis_1.Redis.Cluster(opts.redisClusterEndpoints, opts.redisCluster)
            : new ioredis_1.Redis(opts.redis);
        this.vaaQueue = new bullmq_1.Queue(opts.queueName, {
            prefix: this.prefix,
            connection: this.redis,
        });
        this.batchVaaQueue = new bullmq_1.Queue(opts.queueName + `-batch`, {
            prefix: this.prefix,
            connection: this.redis,
        });
    }
    async addVaaToQueue(vaaBytes) {
        const parsedVaa = (0, wormhole_sdk_1.parseVaa)(vaaBytes);
        const id = this.vaaId(parsedVaa);
        const idWithoutHash = id.substring(0, id.length - 6);
        this.logger?.debug(`Adding VAA to queue`, {
            emitterChain: parsedVaa.emitterChain,
            emitterAddress: parsedVaa.emitterAddress.toString("hex"),
            sequence: parsedVaa.sequence.toString(),
        });
        return this.vaaQueue.add(idWithoutHash, {
            parsedVaa: serializeVaa(parsedVaa),
            vaaBytes: vaaBytes.toString("base64"),
        }, {
            jobId: id,
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: this.opts.attempts,
        });
    }
    async addBatchVaaToQueue(vaa) {
        const batchVaa = (0, batch_model_1.parseSyntheticBatchVaa)(vaa);
        const lastTxHashDigits = batchVaa.transactionId.substring(batchVaa.transactionId.length - 5);
        const id = `${batchVaa.emitterChain}-${lastTxHashDigits}`;
        return this.batchVaaQueue.add(id, {
            parsedVaas: batchVaa.vaas.map(serializeVaa),
            vaaBytes: vaa.toString("base64"),
        }, {
            jobId: id,
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: this.opts.attempts,
        });
    }
    vaaId(vaa) {
        const emitterAddress = vaa.emitterAddress.toString("hex");
        const hash = vaa.hash.toString("base64").substring(0, 5);
        let sequence = vaa.sequence.toString();
        return `${vaa.emitterChain}/${emitterAddress}/${sequence}/${hash}`;
    }
    startWorker() {
        const queueName = this.vaaQueue.name;
        this.logger?.debug(`Starting worker for queue: ${queueName}. Prefix: ${this.prefix}.`);
        this.worker = new bullmq_1.Worker(queueName, async (job) => {
            let parsedVaa = job.data?.parsedVaa;
            if (parsedVaa) {
                this.logger?.debug(`Starting job: ${job.id}`, {
                    emitterChain: parsedVaa.emitterChain,
                    emitterAddress: parsedVaa.emitterAddress.toString("hex"),
                    sequence: parsedVaa.sequence.toString(),
                });
            }
            else {
                this.logger.debug("Received job with no parsedVaa");
            }
            await job.log(`processing by..${this.worker.id}`);
            let vaaBytes = Buffer.from(job.data.vaaBytes, "base64");
            await this.relayer.pushVaaThroughPipeline(vaaBytes, {
                storage: { job, worker: this.worker },
            });
            await job.updateProgress(100);
            return [""];
        }, {
            prefix: this.prefix,
            connection: this.redis,
            concurrency: this.opts.concurrency,
        });
    }
    startBatchWorker() {
        const queueName = this.batchVaaQueue.name;
        this.logger?.debug(`Starting worker for queue: ${queueName}. Prefix: ${this.prefix}.`);
        this.batchWorker = new bullmq_1.Worker(queueName, async (job) => {
            this.logger?.debug(`Starting job: ${job.id} for batch.`);
            await job.log(`processing by..${this.worker.id}`);
            let vaaBytes = Buffer.from(job.data.vaaBytes, "base64");
            await this.relayer.pushVaaThroughPipeline(vaaBytes, {
                storage: { job, worker: this.worker },
            });
            await job.updateProgress(100);
            return [""];
        }, {
            prefix: this.prefix,
            connection: this.redis,
            concurrency: this.opts.concurrency,
        });
    }
    stopWorker() {
        return this.worker?.close();
    }
}
exports.Storage = Storage;
//# sourceMappingURL=storage.js.map