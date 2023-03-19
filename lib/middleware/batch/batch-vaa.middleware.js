"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchVaas = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const ethers_contracts_1 = require("@certusone/wormhole-sdk/lib/cjs/ethers-contracts");
const bullmq_1 = require("bullmq");
const batch_builder_helper_1 = require("./batch-builder.helper");
const vaa_to_log_utils_1 = require("./vaa-to-log.utils");
const batch_model_1 = require("./batch.model");
function findVaaLogsForTx(rx, wormholeContract) {
    const iface = ethers_contracts_1.Implementation__factory.createInterface();
    return rx.logs
        .filter((l) => l.address === wormholeContract.address)
        .map((l) => iface.parseLog(l));
}
function spawnPendingBatchesWorker(opts, queue, fetchVaa, processBatch) {
    new bullmq_1.Worker(queue.name, async (job) => {
        const data = job.data;
        const batch = batch_builder_helper_1.SyntheticBatchVaaBuilder.deserialize(data, fetchVaa);
        const beforePct = batch.pctComplete;
        const isComplete = await batch.fetchPending();
        if (isComplete) {
            processBatch(batch);
            return;
        }
        if (beforePct < batch.pctComplete) {
            await job.update(batch.serialize()); // we made progress, save it for the next run
        }
        throw new Error("incomplete batch, retry in a bit...");
    }, { prefix: opts.namespace });
}
function batchVaas(app, opts) {
    const pendingBatches = new bullmq_1.Queue("pendingBatches", {
        prefix: opts.namespace,
    });
    const worker = spawnPendingBatchesWorker(opts, pendingBatches, app.fetchVaa, app.processVaa // replace for processBatch
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
            const txReceipt = await wormholeCoreLayer.provider.getTransactionReceipt(`0x${ctx.sourceTxHash}`);
            tx = txReceipt;
        }
        else {
            // otherwise go look up the tx log
            const log = await (0, vaa_to_log_utils_1.findLogFromVaa)(logger, wormholeCoreLayer, ctx.vaa);
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
        const batchVaaBuilder = new batch_builder_helper_1.SyntheticBatchVaaBuilder(tx.transactionHash, vaaKeys, ctx.fetchVaa);
        const allFetched = await batchVaaBuilder.fetchPending();
        if (allFetched) {
            ctx.processVaa((0, batch_model_1.serializeSyntheticBatch)(batchVaaBuilder.build()));
            return;
        }
        // There's a chance some logs don't have a corresponding VAA yet, if so, we should wait a bit and try to fetch the remaining vaas in a bit.
        // 7. Add batch to queue of pending to be picked up by a worker and see if we can get all the vaas
        await pendingBatches.add(`${batchVaaBuilder.id}-${batchVaaBuilder.pctComplete}`, batchVaaBuilder.serialize(), { delay: 500, removeOnComplete: 1000, removeOnFail: 5000, attempts: 10 });
    };
}
exports.batchVaas = batchVaas;
//# sourceMappingURL=batch-vaa.middleware.js.map