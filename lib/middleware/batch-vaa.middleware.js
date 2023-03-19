"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchVaas = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const ethers_contracts_1 = require("@certusone/wormhole-sdk/lib/cjs/ethers-contracts");
const bullmq_1 = require("bullmq");
async function findLogForVaa(logger, whCoreLayer, vaa) {
    const currentBlock = await whCoreLayer.provider.getBlockNumber();
    const sequence = vaa.sequence.toString();
    const sender = vaa.emitterAddress.toString("hex");
    const filter = whCoreLayer.filters.LogMessagePublished(`0x${sender}`);
    let log;
    for (let i = 0; !!log || i > 30; ++i) {
        const paginatedLogs = await whCoreLayer.queryFilter(filter, currentBlock - (i + 1) * 20, currentBlock - i * 20);
        log = paginatedLogs.find((log) => log.args.sequence.toString() === sequence);
    }
    return log;
}
function findVaaLogsForTx(rx, wormholeContract) {
    const iface = ethers_contracts_1.Implementation__factory.createInterface();
    return rx.logs
        .filter((l) => l.address === wormholeContract.address)
        .map((l) => iface.parseLog(l));
}
function spawnPendingBatchesWorker(opts, queue, fetchVaa, processBatch) {
    new bullmq_1.Worker(queue.name, async (job) => {
        const data = job.data;
        const batch = SyntheticBatchVaaBuilder.fromJSON(data, fetchVaa);
        const isComplete = await batch.fetchPending();
        if (isComplete) {
            processBatch(batch);
            return;
        }
        throw new Error("incomplete batch, retry in a bit...");
    }, { prefix: opts.namespace });
}
function batchVaas(app, opts) {
    const pendingBatches = new bullmq_1.Queue("pendingBatches", {
        prefix: opts.namespace,
    });
    const worker = spawnPendingBatchesWorker(opts, pendingBatches, app.fetchVaa, app.processBatchVaa // replace for processBatch
    );
    return async (ctx, next) => {
        if (!ctx.vaa || !ctx.vaa.nonce) {
            //not a batch, skip this middleware
            await next();
            return;
        }
        const logger = ctx.logger;
        const emitterChain = ctx.vaa.emitterChain;
        const wormholeCoreLayer = ctx.wormhole.contracts.read.evm[emitterChain][0];
        // 1. Find evm log for this vaa
        let tx;
        if (ctx.sourceTxHash) {
            // if you're using the source tx middleware, just use the hash provided by it.
            const txReceipt = await wormholeCoreLayer.provider.getTransactionReceipt(ctx.sourceTxHash);
            tx = txReceipt;
        }
        else {
            // otherwise go look up the tx log
            const log = await findLogForVaa(logger, wormholeCoreLayer, ctx.vaa);
            if (!log) {
                logger?.error("Could not find log for VAA");
                await next();
                return;
            }
            logger?.info(`Found log for vaa`);
            // 2. Find Transaction that emitted that log
            tx = await log.getTransactionReceipt();
        }
        logger?.info(`Found ContractReceipt for log`);
        // 3. Get all logs for the given transaction
        const vaaLogs = findVaaLogsForTx(tx, wormholeCoreLayer);
        // 4. Keep only logs that are part of a batch
        const batchLogs = vaaLogs.filter((l) => l.args.nonce != 0);
        // 5. Transform logs into vaa keys
        const vaaKeys = batchLogs.map((l) => ({
            emitterChain: emitterChain,
            emitterAddress: Buffer.from((0, wormhole_sdk_1.tryNativeToHexString)(l.args.sender, wormhole_sdk_1.CHAIN_ID_TO_NAME[emitterChain]), "hex"),
            sequence: l.args.sequence.toString(),
        }));
        // 6. Try to transform all keys into VAAs, this may or may not work depending on whether the VAA has already been emitted or not
        const batchVaaBuilder = new SyntheticBatchVaaBuilder(tx.transactionHash, vaaKeys, ctx.fetchVaa);
        const allFetched = await batchVaaBuilder.fetchPending();
        if (allFetched) {
            ctx.processBatchVaa(batchVaaBuilder.build());
            return;
        }
        // There's a chance some logs don't have a corresponding VAA yet, if so, we should wait a bit and try to fetch the remaining vaas in a bit.
        // 7. Add batch to queue of pending to be picked up by a worker and see if we can get all the vaas
        await pendingBatches.add(`${batchVaaBuilder.id}-${batchVaaBuilder.pctComplete}`, batchVaaBuilder.toJSON(), { delay: 500, removeOnComplete: 1000, removeOnFail: 5000, attempts: 10 });
    };
}
exports.batchVaas = batchVaas;
class SyntheticBatchVaaBuilder {
    txHash;
    vaaIds;
    fetchVaa;
    vaaBytes;
    fetchedVaas;
    pendingVaas;
    id;
    emitterChain;
    constructor(txHash, vaaIds, fetchVaa) {
        this.txHash = txHash;
        this.vaaIds = vaaIds;
        this.fetchVaa = fetchVaa;
        this.id = txHash;
        this.pendingVaas = {};
        for (const id of vaaIds) {
            this.pendingVaas[this.idToKey(id)] = id;
        }
        this.fetchedVaas = {};
        this.vaaBytes = {};
    }
    idToKey = (id) => `${id.emitterChain}/${id.emitterAddress.toString("hex")}/${id.sequence.toString()}`;
    // returns true if all remaining vaas have been fetched, false otherwise
    async fetchPending() {
        if (!this.pendingVaas.length) {
            return true;
        }
        const fetched = await Promise.all(Object.values(this.pendingVaas).map(async ({ emitterChain, emitterAddress, sequence }) => {
            try {
                return await this.fetchVaa(emitterChain, emitterAddress, sequence);
            }
            catch (e) {
                return null;
            }
        }));
        const vaas = fetched.filter((vaa) => vaa !== null && vaa.length > 0);
        this.addVaaPayloads(vaas);
    }
    addVaaPayload(vaaBytes) {
        const parsedVaa = (0, wormhole_sdk_1.parseVaa)(vaaBytes);
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
    addVaaPayloads(vaaBytesArr) {
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
    toJSON() {
        return {
            vaaBytes: Object.values(this.vaaBytes).map((buffer) => buffer.toString("base64")),
            vaaIds: this.vaaIds,
            txHash: this.txHash,
        };
    }
    static fromJSON(serialized, fetchVaa) {
        const vaaBytes = serialized.vaaBytes.map((str) => Buffer.from(str, "base64"));
        const builder = new SyntheticBatchVaaBuilder(serialized.txHash, serialized.vaaIds, fetchVaa);
        builder.addVaaPayloads(vaaBytes);
        return builder;
    }
    build() {
        return {
            vaas: Object.values(this.fetchedVaas),
            vaaBytes: this.vaaBytes,
        };
    }
}
//# sourceMappingURL=batch-vaa.middleware.js.map