import { describe, it, expect, vi } from "vitest";
import {
    resolveConfigFromEnv,
    assertEnvConfigValid,
} from "../../../src/config/index.js";
import { OperatorKeyType } from "../../../src/types/index.js";
import { HieroErrorCodes } from "../../../src/errors/index.js";

describe("resolveConfigFromEnv", () => {
    const env = process.env;

    it("throws CONFIG_INVALID asking for a config object when process is undefined", () => {
        vi.stubGlobal("process", undefined);
        try {
            expect(() => resolveConfigFromEnv()).toThrow(
                expect.objectContaining({
                    code: HieroErrorCodes.ConfigInvalid,
                    message: expect.stringContaining(
                        "Pass a HieroConfig object instead",
                    ),
                }),
            );
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("throws CONFIG_INVALID naming every missing env var", () => {
        process.env = {};
        try {
            expect(() => resolveConfigFromEnv()).toThrow(
                expect.objectContaining({
                    code: HieroErrorCodes.ConfigInvalid,
                    message: expect.stringMatching(
                        /HIERO_NETWORK[\s\S]*HIERO_OPERATOR_ID[\s\S]*HIERO_OPERATOR_KEY[\s\S]*HIERO_OPERATOR_KEY_TYPE/,
                    ),
                }),
            );
        } finally {
            process.env = env;
        }
    });

    it("resolves HIERO_ prefixed env vars", () => {
        process.env = {
            HIERO_NETWORK: "testnet",
            HIERO_OPERATOR_ID: "0.0.1",
            HIERO_OPERATOR_KEY: "key123",
            HIERO_OPERATOR_KEY_TYPE: "ECDSA",
        };
        const config = resolveConfigFromEnv();
        expect(config).toMatchObject({
            network: "testnet",
            operatorId: "0.0.1",
            operatorKey: "key123",
            operatorKeyType: OperatorKeyType.ECDSA,
        });
        process.env = env;
    });

    it("throws CONFIG_INVALID when operatorKeyType is missing", () => {
        process.env = {
            HIERO_NETWORK: "testnet",
            HIERO_OPERATOR_ID: "0.0.1",
            HIERO_OPERATOR_KEY: "key123",
        };
        try {
            expect(() => resolveConfigFromEnv()).toThrow(
                expect.objectContaining({
                    code: HieroErrorCodes.ConfigInvalid,
                    message: expect.stringContaining("HIERO_OPERATOR_KEY_TYPE"),
                }),
            );
        } finally {
            process.env = env;
        }
    });

    it("throws CONFIG_INVALID for an unknown operatorKeyType", () => {
        process.env = {
            HIERO_NETWORK: "testnet",
            HIERO_OPERATOR_ID: "0.0.2",
            HIERO_OPERATOR_KEY: "abc",
            HIERO_OPERATOR_KEY_TYPE: "rsa",
        };
        try {
            expect(() => resolveConfigFromEnv()).toThrow(
                expect.objectContaining({
                    code: HieroErrorCodes.ConfigInvalid,
                    message: `HIERO_OPERATOR_KEY_TYPE must be one of 'ed25519', 'ecdsa', 'der', got "rsa".`,
                }),
            );
        } finally {
            process.env = env;
        }
    });

    it("parses HIERO_NETWORK_NODES for custom networks", () => {
        process.env = {
            HIERO_NETWORK: "local",
            HIERO_OPERATOR_ID: "0.0.1",
            HIERO_OPERATOR_KEY: "key123",
            HIERO_OPERATOR_KEY_TYPE: "ed25519",
            HIERO_NETWORK_NODES: "127.0.0.1:50211=0.0.3, 127.0.0.1:50212=0.0.4",
        };
        expect(resolveConfigFromEnv().networkNodes).toMatchObject({
            "127.0.0.1:50211": "0.0.3",
            "127.0.0.1:50212": "0.0.4",
        });
        process.env = env;
    });

    it.each(["127.0.0.1:50211", "=0.0.3", "127.0.0.1:50211="])(
        "rejects the malformed HIERO_NETWORK_NODES entry %s with CONFIG_INVALID",
        (entry) => {
            process.env = {
                HIERO_NETWORK: "local",
                HIERO_OPERATOR_ID: "0.0.1",
                HIERO_OPERATOR_KEY: "key123",
                HIERO_OPERATOR_KEY_TYPE: "ed25519",
                HIERO_NETWORK_NODES: `127.0.0.1:50212=0.0.4,${entry}`,
            };
            try {
                expect(() => resolveConfigFromEnv()).toThrow(
                    expect.objectContaining({
                        code: HieroErrorCodes.ConfigInvalid,
                        message: `HIERO_NETWORK_NODES entry "${entry}" is malformed. Expected "host:port=accountId".`,
                    }),
                );
            } finally {
                process.env = env;
            }
        },
    );

    it("ignores empty HIERO_NETWORK_NODES entries", () => {
        process.env = {
            HIERO_NETWORK: "local",
            HIERO_OPERATOR_ID: "0.0.1",
            HIERO_OPERATOR_KEY: "key123",
            HIERO_OPERATOR_KEY_TYPE: "ed25519",
            HIERO_NETWORK_NODES: "127.0.0.1:50211=0.0.3,",
        };
        expect(resolveConfigFromEnv().networkNodes).toEqual({
            "127.0.0.1:50211": "0.0.3",
        });
        process.env = env;
    });

    it("parses HIERO_MIRROR_NETWORK and HIERO_MIRROR_NODE_URL", () => {
        process.env = {
            HIERO_NETWORK: "local",
            HIERO_OPERATOR_ID: "0.0.1",
            HIERO_OPERATOR_KEY: "key123",
            HIERO_OPERATOR_KEY_TYPE: "ed25519",
            HIERO_MIRROR_NETWORK: "localhost:5600, localhost:5601",
            HIERO_MIRROR_NODE_URL: "http://localhost:5551",
        };
        expect(resolveConfigFromEnv()).toMatchObject({
            mirrorNetwork: ["localhost:5600", "localhost:5601"],
            mirrorNodeUrl: "http://localhost:5551",
        });
        process.env = env;
    });

    it("leaves the mirror fields unset when their env vars are empty", () => {
        process.env = {
            HIERO_NETWORK: "local",
            HIERO_OPERATOR_ID: "0.0.1",
            HIERO_OPERATOR_KEY: "key123",
            HIERO_OPERATOR_KEY_TYPE: "ed25519",
            HIERO_MIRROR_NETWORK: "",
            HIERO_MIRROR_NODE_URL: "",
        };
        const config = resolveConfigFromEnv();
        expect(config.mirrorNetwork).toBeUndefined();
        expect(config.mirrorNodeUrl).toBeUndefined();
        process.env = env;
    });

    it("parses the SDK tuning env vars", () => {
        process.env = {
            HIERO_NETWORK: "testnet",
            HIERO_OPERATOR_ID: "0.0.1",
            HIERO_OPERATOR_KEY: "key123",
            HIERO_OPERATOR_KEY_TYPE: "ed25519",
            HIERO_REQUEST_TIMEOUT_MS: "60000",
            HIERO_GRPC_DEADLINE_MS: "5000",
            HIERO_MAX_ATTEMPTS: "3",
            HIERO_MIN_BACKOFF_MS: "100",
            HIERO_MAX_BACKOFF_MS: "4000",
        };
        expect(resolveConfigFromEnv()).toMatchObject({
            requestTimeoutMs: 60000,
            grpcDeadlineMs: 5000,
            maxAttempts: 3,
            minBackoffMs: 100,
            maxBackoffMs: 4000,
        });
        process.env = env;
    });

    it("leaves the SDK tuning fields unset when their env vars are empty", () => {
        process.env = {
            HIERO_NETWORK: "testnet",
            HIERO_OPERATOR_ID: "0.0.1",
            HIERO_OPERATOR_KEY: "key123",
            HIERO_OPERATOR_KEY_TYPE: "ed25519",
            HIERO_MAX_ATTEMPTS: "",
        };
        const config = resolveConfigFromEnv();
        expect(config.requestTimeoutMs).toBeUndefined();
        expect(config.maxAttempts).toBeUndefined();
        process.env = env;
    });

    it.each(["abc", "0", "-5", "Infinity"])(
        "rejects HIERO_MAX_ATTEMPTS=%s with CONFIG_INVALID",
        (value) => {
            process.env = {
                HIERO_NETWORK: "testnet",
                HIERO_OPERATOR_ID: "0.0.1",
                HIERO_OPERATOR_KEY: "key123",
                HIERO_OPERATOR_KEY_TYPE: "ed25519",
                HIERO_MAX_ATTEMPTS: value,
            };
            try {
                expect(() => resolveConfigFromEnv()).toThrow(
                    expect.objectContaining({
                        code: HieroErrorCodes.ConfigInvalid,
                        message: `HIERO_MAX_ATTEMPTS must be a positive number, got "${value}".`,
                    }),
                );
            } finally {
                process.env = env;
            }
        },
    );
});

describe("assertEnvConfigValid", () => {
    const env = process.env;

    it("throws CONFIG_INVALID for an unknown operatorKeyType", () => {
        process.env = {
            HIERO_NETWORK: "testnet",
            HIERO_OPERATOR_ID: "0.0.2",
            HIERO_OPERATOR_KEY: "abc",
            HIERO_OPERATOR_KEY_TYPE: "rsa",
        };
        try {
            expect(() => assertEnvConfigValid()).toThrow(
                expect.objectContaining({
                    code: HieroErrorCodes.ConfigInvalid,
                }),
            );
        } finally {
            process.env = env;
        }
    });

    it("does not throw when env is valid", () => {
        process.env = {
            HIERO_NETWORK: "testnet",
            HIERO_OPERATOR_ID: "0.0.1",
            HIERO_OPERATOR_KEY: "key123",
            HIERO_OPERATOR_KEY_TYPE: "ed25519",
        };
        expect(() => assertEnvConfigValid()).not.toThrow();
        process.env = env;
    });
});
