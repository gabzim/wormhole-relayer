import { Next } from "wormhole-relayer";
import { MyRelayerContext } from "./app";

export class ApiController {
  processFundsTransfer = async (ctx: MyRelayerContext, next: Next) => {
    let seq = ctx.vaa?.sequence?.toString();
    ctx.logger.info(`chain middleware - ${seq} - ${ctx.sourceTxHash}`);
    if (ctx.batchVaa) {
      let ix = 0;
      for (const vaa of ctx.batchVaa.vaas) {
        ctx.logger.info(`Vaa: ${ix}`);
        ctx.logger.info(
          `Emitter Address: ${vaa.emitterAddress.toString(
            "hex"
          )}. Sequence: ${vaa.sequence.toString()}`
        );
        ix++;
      }
    }

    await ctx.kv.withKey(["counter"], async ({ counter }) => {
      ctx.logger.debug(`Original counter value ${counter}`);
      counter = (counter ? counter : 0) + 1;
      ctx.logger.info(`Counter value after update ${counter}`);
      return {
        newKV: { counter },
        val: counter,
      };
    });
    await next();
  };
}
