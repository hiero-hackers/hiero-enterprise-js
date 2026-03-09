import Fastify from "fastify";
import { hieroPlugin } from "@hiero-enterprise/fastify";

const app = Fastify({ logger: true });

// ─── Hiero Integration ────────────────────────────────────────
// Register the plugin — all services are available at app.hiero.
// Config is read from env vars (HIERO_NETWORK, HIERO_OPERATOR_ID, HIERO_OPERATOR_KEY).
await app.register(hieroPlugin);

// ─── Root Route ───────────────────────────────────────────────

app.get("/", async () => {
    return {
        service: "Hiero Fastify Sample",
        message:
            "Server is running. Try one of the endpoints below to view data.",
        endpoints: {
            accounts: [
                "GET /api/balance",
                "GET /api/accounts/:id",
                "GET /api/accounts/:id/nfts",
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
});

// ─── Account Routes ───────────────────────────────────────────

/** Get the operator account balance */
app.get("/api/balance", async () => {
    return app.hiero.accountClient.getOperatorAccountBalance();
});

/** Query an account from the mirror node */
app.get<{ Params: { id: string } }>("/api/accounts/:id", async (request) => {
    return app.hiero.accountRepository.findByAccountId(request.params.id);
});

/** Query NFTs owned by an account */
app.get<{ Params: { id: string } }>(
    "/api/accounts/:id/nfts",
    async (request) => {
        return app.hiero.nftRepository.findByOwner(request.params.id);
    },
);

// ─── Token Routes ─────────────────────────────────────────────

/** Query a token by ID */
app.get<{ Params: { id: string } }>("/api/tokens/:id", async (request) => {
    return app.hiero.tokenRepository.findById(request.params.id);
});

// ─── Topic Routes ─────────────────────────────────────────────

/** Query topic messages */
app.get<{ Params: { id: string } }>(
    "/api/topics/:id/messages",
    async (request) => {
        return app.hiero.topicRepository.findByTopicId(request.params.id);
    },
);

/** Create a new public topic */
app.post<{ Body: { memo?: string } }>("/api/topics", async (request, reply) => {
    const topicId = await app.hiero.topicClient.createTopic({
        memo: request.body.memo,
    });
    reply.code(201);
    return { topicId };
});

/** Submit a message to a topic */
app.post<{ Params: { id: string }; Body: { message: string } }>(
    "/api/topics/:id/messages",
    async (request, reply) => {
        await app.hiero.topicClient.submitMessage(
            request.params.id,
            request.body.message,
        );
        reply.code(202);
        return { status: "submitted" };
    },
);

// ─── Network Routes ───────────────────────────────────────────

/** Query exchange rates */
app.get("/api/network/exchange-rates", async () => {
    return app.hiero.networkRepository.findExchangeRates();
});

/** Query network supply */
app.get("/api/network/supply", async () => {
    return app.hiero.networkRepository.findNetworkSupplies();
});

// ─── Start ────────────────────────────────────────────────────

const port = Number(process.env["PORT"] ?? 3001);

try {
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Hiero Fastify sample running on http://localhost:${port}`);
    console.log();
    console.log("  Available endpoints:");
    console.log("    GET  /api/balance");
    console.log("    GET  /api/accounts/:id");
    console.log("    GET  /api/accounts/:id/nfts");
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
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
