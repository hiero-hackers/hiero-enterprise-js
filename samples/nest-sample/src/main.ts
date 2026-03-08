import { Module, Controller, Get, Post, Param, Body } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
    AccountClient,
    TopicClient,
    AccountRepository,
    NftRepository,
    TokenRepository,
    TopicRepository,
    NetworkRepository,
    HieroModule,
} from "@hiero-enterprise/nest";

// ─── Controllers ──────────────────────────────────────────────

@Controller()
class RootController {
    @Get()
    root() {
        return {
            service: "Hiero NestJS Sample",
            message:
                "Server is running. Try one of the endpoints below to view data.",
            endpoints: {
                accounts: [
                    "GET  /api/balance",
                    "GET  /api/accounts/:id",
                    "GET  /api/accounts/:id/nfts",
                    "POST /api/accounts",
                ],
                tokens: ["GET /api/tokens/:id"],
                topics: [
                    "GET  /api/topics/:id/messages",
                    "POST /api/topics",
                    "POST /api/topics/:id/messages",
                ],
                network: [
                    "GET /api/network/exchange-rates",
                    "GET /api/network/supply",
                ],
            },
        };
    }
}

@Controller("api")
class AccountController {
    constructor(
        private readonly accountClient: AccountClient,
        private readonly accountRepo: AccountRepository,
        private readonly nftRepo: NftRepository,
    ) {}

    @Get("balance")
    getBalance() {
        return this.accountClient.getOperatorAccountBalance();
    }

    @Get("accounts/:id")
    getAccount(@Param("id") id: string) {
        return this.accountRepo.findByAccountId(id);
    }

    @Get("accounts/:id/nfts")
    getAccountNfts(@Param("id") id: string) {
        return this.nftRepo.findByOwner(id);
    }

    @Post("accounts")
    async createAccount(
        @Body() body: { initialBalance?: number; memo?: string },
    ) {
        const account = await this.accountClient.createAccount({
            initialBalance: body.initialBalance,
            memo: body.memo,
        });
        return {
            message: "Account created successfully",
            accountId: account.accountId,
            publicKey: account.publicKey,
            privateKey: account.privateKey,
            evmAddress: account.evmAddress,
        };
    }
}

@Controller("api/tokens")
class TokenController {
    constructor(private readonly tokenRepo: TokenRepository) {}

    @Get(":id")
    getToken(@Param("id") id: string) {
        return this.tokenRepo.findById(id);
    }
}

@Controller("api/topics")
class TopicController {
    constructor(
        private readonly topicClient: TopicClient,
        private readonly topicRepo: TopicRepository,
    ) {}

    @Get(":id/messages")
    getMessages(@Param("id") id: string) {
        return this.topicRepo.findByTopicId(id);
    }

    @Post()
    async createTopic(@Body() body: { memo?: string }) {
        const topicId = await this.topicClient.createTopic({ memo: body.memo });
        return { topicId };
    }

    @Post(":id/messages")
    async submitMessage(
        @Param("id") id: string,
        @Body() body: { message: string },
    ) {
        await this.topicClient.submitMessage(id, body.message);
        return { status: "submitted" };
    }
}

@Controller("api/network")
class NetworkController {
    constructor(private readonly networkRepo: NetworkRepository) {}

    @Get("exchange-rates")
    getExchangeRates() {
        return this.networkRepo.findExchangeRates();
    }

    @Get("supply")
    getSupply() {
        return this.networkRepo.findNetworkSupplies();
    }
}

// ─── App Module ───────────────────────────────────────────────

@Module({
    imports: [HieroModule.forRoot()],
    controllers: [
        RootController,
        AccountController,
        TokenController,
        TopicController,
        NetworkController,
    ],
})
class AppModule {}

// ─── Bootstrap ────────────────────────────────────────────────

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const port = process.env["PORT"] ?? 3002;
    await app.listen(port);
    console.log(`🏗️  Hiero NestJS sample running on http://localhost:${port}`);
    console.log();
    console.log("  Available endpoints:");
    console.log("    GET  /api/balance");
    console.log("    GET  /api/accounts/:id");
    console.log("    GET  /api/accounts/:id/nfts");
    console.log("    POST /api/accounts");
    console.log("    GET  /api/tokens/:id");
    console.log("    GET  /api/topics/:id/messages");
    console.log("    POST /api/topics");
    console.log("    POST /api/topics/:id/messages");
    console.log("    GET  /api/network/exchange-rates");
    console.log("    GET  /api/network/supply");
    console.log();
    console.log("  Try opening in your browser:");
    console.log(`    http://localhost:${port}/api/balance`);
    console.log(`    http://localhost:${port}/api/network/supply`);
    console.log();
}
bootstrap().catch((err) => {
    console.error("Bootstrap failed:", err);
    process.exit(1);
});
