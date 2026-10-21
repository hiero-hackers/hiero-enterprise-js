import express from "express";
import {
    JSONRPCErrorCode,
    JSONRPCServer,
    createJSONRPCErrorResponse,
    createJSONRPCSuccessResponse,
} from "json-rpc-2.0";
import type {
    JSONRPCParams,
    JSONRPCRequest,
    SimpleJSONRPCMethod,
} from "json-rpc-2.0";
import { HieroError } from "@hiero-hackers/enterprise-core";
import { HEDERA_ERROR, NotSupportedError } from "./errors.js";
import * as sdk from "./methods/sdk.js";
import * as key from "./methods/key.js";
import * as topic from "./methods/topic.js";
import * as account from "./methods/account.js";
import * as token from "./methods/token.js";

const server = new JSONRPCServer();

for (const methods of [sdk, key, topic, account, token]) {
    for (const [name, method] of Object.entries(methods)) {
        server.addMethod(name, method as SimpleJSONRPCMethod);
    }
}

/**
 * Report errors the way the TCK expects (as the hiero-sdk-js adapter does):
 * a status the network returned as a "Hedera error" carrying `status`, and
 * everything else, including core's own validation (`INPUT_INVALID`), as an
 * internal error.
 */
server.applyMiddleware(
    async (
        next: SimpleJSONRPCMethod,
        request: JSONRPCRequest,
        serverParams: JSONRPCParams,
    ) => {
        try {
            return await next(request, serverParams);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            const method = JSON.stringify(request.method);
            if (error instanceof NotSupportedError) {
                console.warn(`Skipped ${method}: ${message}`);
                return createJSONRPCSuccessResponse(request.id ?? null, {
                    error: "NOT_IMPLEMENTED",
                    message,
                });
            }
            if (error instanceof HieroError && error.sdkStatus) {
                console.error(`Hedera error in ${method}: ${message}`);
                return createJSONRPCErrorResponse(
                    request.id ?? null,
                    HEDERA_ERROR,
                    "Hedera Error",
                    { status: error.sdkStatus, message },
                );
            }
            const code =
                (error as { code?: number }).code ===
                JSONRPCErrorCode.InvalidParams
                    ? JSONRPCErrorCode.InvalidParams
                    : JSONRPCErrorCode.InternalError;
            console.error(`Internal error in ${method}: ${message}`);
            return createJSONRPCErrorResponse(
                request.id ?? null,
                code,
                code === JSONRPCErrorCode.InvalidParams
                    ? "Invalid params error"
                    : "Internal error",
                { message },
            );
        }
    },
);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.post("/", async (req, res) => {
    const response = await server.receive(req.body);
    if (response) res.json(response);
    else res.sendStatus(204);
});

const port = Number(process.argv[2] ?? 8544);
app.listen(port, () => {
    console.log(`-- enterprise-core TCK adapter on localhost:${port}`);
});
