import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { closeSession, openSession, replaceOperator } from "../session.js";

const require = createRequire(import.meta.url);
const CORE_VERSION = JSON.parse(
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- core's own package.json, from require.resolve
    readFileSync(
        require.resolve("@hiero-hackers/enterprise-core/package.json"),
        "utf8",
    ),
).version;

interface SetupParams {
    readonly operatorAccountId?: string;
    readonly operatorPrivateKey?: string;
    readonly nodeIp?: string;
    readonly nodeAccountId?: string;
    readonly mirrorNetworkIp?: string;
    readonly sessionId?: string;
}

const requireOperator = (params: SetupParams) => {
    if (!params.operatorAccountId || !params.operatorPrivateKey) {
        throw new Error(
            "Operator credentials missing: operatorAccountId/operatorPrivateKey",
        );
    }

    return [params.operatorAccountId, params.operatorPrivateKey] as const;
};

/** Reports what the TCK run is testing. */
export const version = (): string => `hiero-enterprise-js ${CORE_VERSION}`;

export const setup = (params: SetupParams) => {
    const [operatorId, operatorKey] = requireOperator(params);
    const created = openSession(
        params.sessionId,
        params,
        operatorId,
        operatorKey,
    );

    return {
        message: created
            ? "Successfully setup client"
            : `Client already set up for session: ${params.sessionId}`,
        status: "SUCCESS",
    };
};

export const setOperator = (params: SetupParams) => {
    const [operatorId, operatorKey] = requireOperator(params);
    replaceOperator(params.sessionId, operatorId, operatorKey);

    return { message: "Operator updated", status: "SUCCESS" };
};

export const reset = (params: { sessionId?: string }) => {
    closeSession(params.sessionId);

    return { status: "SUCCESS" };
};
