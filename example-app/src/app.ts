import yargs from "yargs";
import * as Koa from "koa";
import {
  Context,
  Environment,
  RelayerApp,
  StorageContext,
} from "wormhole-relayer";
import { CHAIN_ID_ETH, CHAIN_ID_SOLANA } from "@certusone/wormhole-sdk";
import {
  logging,
  LoggingContext,
} from "wormhole-relayer/middleware/logger.middleware";
import {
  TokenBridgeContext,
  tokenBridgeContracts,
} from "wormhole-relayer/middleware/token-bridge.middleware";
import { missedVaas } from "wormhole-relayer/middleware/missed-vaas.middleware";
import { providers } from "wormhole-relayer/middleware/providers.middleware";
import {
  stagingArea,
  StagingAreaContext,
} from "wormhole-relayer/middleware/staging-area.middleware";

import { WalletContext } from "wormhole-relayer/middleware/wallet/wallet.middleware";

import { rootLogger } from "./log";
import { ApiController } from "./controller";
import { Logger } from "winston";
import {
  sourceTx,
  SourceTxContext,
} from "../../relayer/middleware/source-tx.middleware";
import { batchVaas } from "../../relayer/middleware/batch/batch-vaa.middleware";
import {
  CoreLayerContext,
  coreLayerContracts,
} from "../../relayer/middleware/core-layer.middleware";

export type MyRelayerContext = LoggingContext &
  StorageContext &
  CoreLayerContext &
  SourceTxContext &
  TokenBridgeContext &
  StagingAreaContext &
  WalletContext;

const privateKeys = {
  [CHAIN_ID_ETH]: [process.env.ETH_KEY],
};

async function main() {
  let opts: any = yargs(process.argv.slice(2)).argv;

  const env = Environment.TESTNET;
  const app = new RelayerApp<MyRelayerContext>(env);
  const fundsCtrl = new ApiController();

  // Config
  configRelayer(app);

  // Set up middleware
  app.use(logging(rootLogger)); // <-- logging middleware
  app.use(missedVaas(app, { namespace: "simple", logger: rootLogger }));
  app.use(providers());
  // app.use(wallets({ logger: rootLogger, namespace: "simple", privateKeys })); // <-- you need a valid private key to turn on this middleware
  app.use(coreLayerContracts());
  app.use(tokenBridgeContracts());
  app.use(stagingArea());
  app.use(sourceTx());
  app.use(batchVaas(app, { namespace: "simple" }));

  app
    .chain(CHAIN_ID_SOLANA)
    .address(
      "DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe",
      fundsCtrl.processFundsTransfer
    );

  // Uncomment to test batch vaas:
  // app
  //   .chain(CHAIN_ID_AVAX)
  //   .address(
  //     "0xdde6b89b7d0ad383fafde6477f0d300ec4d4033e",
  //     fundsCtrl.processFundsTransfer
  //   );

  // Another way to do it if you want to listen to multiple addresses on different chaints:

  // let contractAddresses = {
  //   [CHAIN_ID_SOLANA]: ["DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe"],
  // };
  // app.multiple(contractAddresses, fundsCtrl.processFundsTransfer);

  app.use(async (err, ctx, next) => {
    ctx.logger.error("error middleware triggered", err);
  }); // <-- if you pass in a function with 3 args, it'll be used to process errors (whenever you throw from your middleware)

  app.listen();

  runUI(app, opts, rootLogger);
}

function configRelayer<T extends Context>(app: RelayerApp<T>) {
  app.spy("localhost:7073");
  app.useStorage({ attempts: 3, namespace: "simple", queueName: "relays" });
  app.logger(rootLogger);
}

function runUI(relayer: any, { port }: any, logger: Logger) {
  const app = new Koa();

  app.use(relayer.storageKoaUI("/ui"));

  port = Number(port) || 3000;
  app.listen(port, () => {
    logger.info(`Running on ${port}...`);
    logger.info(`For the UI, open http://localhost:${port}/ui`);
    logger.info("Make sure Redis is running on port 6379 by default");
  });
}

main();
