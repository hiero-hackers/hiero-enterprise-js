import type { HieroConfig } from "@hiero-enterprise/core";
import {
    HieroContext,
    resolveConfigFromEnv,
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

// ─── Injection Tokens ──────────────────────────────────────────

export const HIERO_CONFIG = "HIERO_CONFIG";
export const HIERO_CONTEXT = "HIERO_CONTEXT";

// ─── HieroModule ───────────────────────────────────────────────

/**
 * NestJS module that provides all Hiero services.
 *
 * @example
 * ```ts
 * // Option 1: Environment-based config
 * import { HieroModule } from '@hiero-enterprise/nest';
 * \@Module({ imports: [HieroModule.forRoot()] })
 * export class AppModule {}
 *
 * // Option 2: Explicit config
 * \@Module({
 *   imports: [HieroModule.forRoot({ network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' })]
 * })
 * export class AppModule {}
 * ```
 */
export class HieroModule {
    /**
     * Register the module with all Hiero services as providers.
     *
     * @param config - Optional explicit config (falls back to env vars)
     * @returns Dynamic NestJS module definition
     */
    static forRoot(config?: HieroConfig): NestDynamicModule {
        const resolved = config ?? resolveConfigFromEnv();
        if (!resolved) {
            throw new Error(
                "HieroModule.forRoot(): No config provided and env vars not set.",
            );
        }

        const context = HieroContext.initialize(resolved);
        const mirrorNodeUrl = resolveMirrorNodeUrl(
            context.config.network,
            context.config.mirrorNodeUrl,
        );
        const mirrorNodeClient = new MirrorNodeClient(mirrorNodeUrl);

        return {
            module: HieroModule,
            providers: [
                { provide: HIERO_CONFIG, useValue: resolved },
                { provide: HIERO_CONTEXT, useValue: context },
                { provide: MirrorNodeClient, useValue: mirrorNodeClient },
                {
                    provide: AccountClient,
                    useValue: new AccountClient(context),
                },
                { provide: FileClient, useValue: new FileClient(context) },
                {
                    provide: FungibleTokenClient,
                    useValue: new FungibleTokenClient(context),
                },
                { provide: NftClient, useValue: new NftClient(context) },
                {
                    provide: SmartContractClient,
                    useValue: new SmartContractClient(context),
                },
                { provide: TopicClient, useValue: new TopicClient(context) },
                {
                    provide: AccountRepository,
                    useValue: new AccountRepository(mirrorNodeClient),
                },
                {
                    provide: NftRepository,
                    useValue: new NftRepository(mirrorNodeClient),
                },
                {
                    provide: TokenRepository,
                    useValue: new TokenRepository(mirrorNodeClient),
                },
                {
                    provide: TopicRepository,
                    useValue: new TopicRepository(mirrorNodeClient),
                },
                {
                    provide: TransactionRepository,
                    useValue: new TransactionRepository(mirrorNodeClient),
                },
                {
                    provide: NetworkRepository,
                    useValue: new NetworkRepository(mirrorNodeClient),
                },
            ],
            exports: [
                HIERO_CONFIG,
                HIERO_CONTEXT,
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
            ],
        };
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => unknown;

/**
 * Minimal subset of NestJS DynamicModule interface.
 * Defined here to avoid runtime dependency on @nestjs/common.
 */
interface NestDynamicModule {
    module: Constructor;
    providers: Array<{
        provide: string | symbol | Constructor;
        useValue: unknown;
    }>;
    exports: Array<string | symbol | Constructor>;
}

// Re-export core types for convenience
export {
    HieroContext,
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

export type { HieroConfig } from "@hiero-enterprise/core";
