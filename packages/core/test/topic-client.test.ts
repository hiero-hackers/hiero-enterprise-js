import { describe, it, expect, vi, beforeEach } from "vitest";
import { HieroContext } from "../src/context/hiero-context.js";
import { TopicClient } from "../src/services/topic-client.js";
import {
    TopicCreateTransaction,
    TopicUpdateTransaction,
    TopicDeleteTransaction,
    TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";

vi.mock("@hashgraph/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hashgraph/sdk")>();

    const createTxMock = () => ({
        setTopicMemo: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setSubmitKey: vi.fn().mockReturnThis(),

        setTopicId: vi.fn().mockReturnThis(),
        setMessage: vi.fn().mockReturnThis(),

        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue({
            execute: vi.fn().mockResolvedValue({
                transactionId: { toString: () => "0.0.123@1234567890" },
                getReceipt: vi.fn().mockResolvedValue({
                    status: { toString: () => "SUCCESS" },
                    topicId: { toString: () => "0.0.999" },
                }),
            }),
        }),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                topicId: { toString: () => "0.0.999" },
            }),
        }),
    });

    return {
        ...actual,
        TopicCreateTransaction: vi.fn(() => createTxMock()),
        TopicUpdateTransaction: vi.fn(() => createTxMock()),
        TopicDeleteTransaction: vi.fn(() => createTxMock()),
        TopicMessageSubmitTransaction: vi.fn(() => createTxMock()),
    };
});

describe("TopicClient", () => {
    let context: HieroContext;
    let client: TopicClient;
    const dummyKey =
        "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";

    beforeEach(() => {
        vi.clearAllMocks();
        HieroContext.reset();
        context = HieroContext.initialize({
            network: "testnet",
            operatorId: "0.0.2",
            operatorKey: dummyKey,
        });
        client = new TopicClient(context);
    });

    describe("createTopic", () => {
        it("creates a public topic", async () => {
            const topicId = await client.createTopic({ memo: "public" });

            expect(topicId).toBe("0.0.999");

            const txMock = vi.mocked(TopicCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setTopicMemo).toHaveBeenCalledWith("public");
            expect(txMock.setAdminKey).toHaveBeenCalled();
            expect(txMock.setSubmitKey).not.toHaveBeenCalled();
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });

        it("creates a public topic with admin key", async () => {
            await client.createTopic({
                memo: "public admin",
                adminKey: dummyKey,
            });

            const txMock = vi.mocked(TopicCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setAdminKey).toHaveBeenCalled();
            expect(txMock.execute).toHaveBeenCalled();
        });
    });

    describe("createPrivateTopic", () => {
        it("creates a private topic", async () => {
            await client.createPrivateTopic({
                adminKey: dummyKey,
                submitKey: dummyKey,
                memo: "private",
            });

            const txMock = vi.mocked(TopicCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setTopicMemo).toHaveBeenCalledWith("private");
            expect(txMock.setAdminKey).toHaveBeenCalled();
            expect(txMock.setSubmitKey).toHaveBeenCalled();
            expect(txMock.execute).toHaveBeenCalled();
        });
    });

    describe("updateTopic", () => {
        it("updates a topic", async () => {
            await client.updateTopic("0.0.999", { memo: "updated" });

            const txMock = vi.mocked(TopicUpdateTransaction).mock.results[0]
                .value;
            expect(txMock.setTopicId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setTopicMemo).toHaveBeenCalledWith("updated");
        });

        it("updates a topic with admin key", async () => {
            await client.updateTopic("0.0.999", {
                memo: "updated",
                adminKey: dummyKey,
            });

            const txMock = vi.mocked(TopicUpdateTransaction).mock.results[0]
                .value;
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("deleteTopic", () => {
        it("deletes a topic", async () => {
            await client.deleteTopic("0.0.999");

            const txMock = vi.mocked(TopicDeleteTransaction).mock.results[0]
                .value;
            expect(txMock.setTopicId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });

        it("deletes a topic with admin key", async () => {
            await client.deleteTopic("0.0.999", dummyKey);

            const txMock = vi.mocked(TopicDeleteTransaction).mock.results[0]
                .value;
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("submitMessage", () => {
        it("submits a message", async () => {
            await client.submitMessage("0.0.999", "hello text");

            const txMock = vi.mocked(TopicMessageSubmitTransaction).mock
                .results[0].value;
            expect(txMock.setTopicId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setMessage).toHaveBeenCalledWith("hello text");
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });

        it("submits a message with submit key", async () => {
            await client.submitMessage("0.0.999", "hello private", dummyKey);

            const txMock = vi.mocked(TopicMessageSubmitTransaction).mock
                .results[0].value;
            expect(txMock.sign).toHaveBeenCalled();
        });
    });
});
