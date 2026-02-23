import type { Request, Response, NextFunction } from "express";
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
 * All services made available through the Express middleware.
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
 * Augment Express Request to include Hiero services.
 */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            hiero: HieroServices;
        }
    }
}

/**
 * Express middleware that initializes the HieroContext and injects all
 * Hiero services into `req.hiero`.
 *
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { hieroMiddleware } from '@hiero-enterprise/express';
 *
 * const app = express();
 * app.use(hieroMiddleware({ network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' }));
 *
 * app.get('/balance', async (req, res) => {
 *   const balance = await req.hiero.accountClient.getOperatorAccountBalance();
 *   res.json(balance);
 * });
 * ```
 */
export function hieroMiddleware(config?: HieroConfig) {
    // Initialize once, share across all requests
    const context = HieroContext.initialize(config);
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

    return (req: Request, _res: Response, next: NextFunction) => {
        req.hiero = services;
        next();
    };
}

export type { HieroConfig } from "@hiero-enterprise/core";
