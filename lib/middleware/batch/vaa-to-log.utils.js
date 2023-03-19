"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLogFromVaa = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
async function findLogFromVaa(logger, whCoreLayer, vaa) {
    const currentBlock = await whCoreLayer.provider.getBlockNumber();
    const sequence = vaa.sequence.toString();
    const sender = (0, wormhole_sdk_1.tryUint8ArrayToNative)(vaa.emitterAddress, vaa.emitterChain);
    const filter = whCoreLayer.filters.LogMessagePublished(sender);
    let log;
    for (let i = 0; !!log || i < 30; ++i) {
        const paginatedLogs = await whCoreLayer.queryFilter(filter, currentBlock - (i + 1) * 20, currentBlock - i * 20);
        log = paginatedLogs.find((log) => log.args.sequence.toString() === sequence);
    }
    return log;
}
exports.findLogFromVaa = findLogFromVaa;
//# sourceMappingURL=vaa-to-log.utils.js.map