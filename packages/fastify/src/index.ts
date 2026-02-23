import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { HieroConfig } from "@hiero-enterprise/core";
import {
    HieroContext,
    resolveMirrorNodeUrl,
    MirrorNodeClient,
    AccountClient,
    FileClient,
    FungibleTokenClient,
    NftClient,
    SmartContractClient,
    TopicClient,
    AccountRepository,
    NftRepository,
    TokenRepository,
    TopicRepository,
    TransactionRepository,
    NetworkRepository,
} from "@hiero-enterprise/core";

/**
 * All services made available through the Fastify plugin.
 */
export interface HieroServices {
    context: HieroContext;
    mirrorNodeClient: MirrorNodeClient;
    accountClient: AccountClient;
    fileClient: FileClient;
    fungibleTokenClient: FungibleTokenClient;
    nftClient: NftClient;
    smartContractClient: SmartContractClient;
    topicClient: TopicClient;
    accountRepository: AccountRepository;
    nftRepository: NftRepository;
    tokenRepository: TokenRepository;
    topicRepository: TopicRepository;
    transactionRepository: TransactionRepository;
    networkRepository: NetworkRepository;
}

/**
 * Augment Fastify instance to include Hiero services.
 */
declare module "fastify" {
    interface FastifyInstance {
        hiero: HieroServices;
    }
}

/**
 * Plugin options — accepts a HieroConfig or reads from environment.
 */
export interface HieroPluginOptions extends FastifyPluginOptions {
    config?: HieroConfig;
}

/**
 * Fastify plugin that initializes the HieroContext and decorates the
 * Fastify instance with all Hiero services at `fastify.hiero`.
 *
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { hieroPlugin } from '@hiero-enterprise/fastify';
 *
 * const app = Fastify();
 * app.register(hieroPlugin, { config: { network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' } });
 *
 * app.get('/balance', async (request, reply) => {
 *   const balance = await app.hiero.accountClient.getOperatorAccountBalance();
 *   return balance;
 * });
 * ```
 */
export async function hieroPlugin(
    fastify: FastifyInstance,
    opts: HieroPluginOptions,
): Promise<void> {
    const context = HieroContext.initialize(opts.config);
    const mirrorNodeUrl = resolveMirrorNodeUrl(
        context.config.network,
        context.config.mirrorNodeUrl,
    );
    const mirrorNodeClient = new MirrorNodeClient(mirrorNodeUrl);

    const services: HieroServices = {
        context,
        mirrorNodeClient,
        accountClient: new AccountClient(context),
        fileClient: new FileClient(context),
        fungibleTokenClient: new FungibleTokenClient(context),
        nftClient: new NftClient(context),
        smartContractClient: new SmartContractClient(context),
        topicClient: new TopicClient(context),
        accountRepository: new AccountRepository(mirrorNodeClient),
        nftRepository: new NftRepository(mirrorNodeClient),
        tokenRepository: new TokenRepository(mirrorNodeClient),
        topicRepository: new TopicRepository(mirrorNodeClient),
        transactionRepository: new TransactionRepository(mirrorNodeClient),
        networkRepository: new NetworkRepository(mirrorNodeClient),
    };

    fastify.decorate("hiero", services);

    // Clean up SDK client on close
    fastify.addHook("onClose", () => {
        HieroContext.reset();
    });
}

export type { HieroConfig } from "@hiero-enterprise/core";
