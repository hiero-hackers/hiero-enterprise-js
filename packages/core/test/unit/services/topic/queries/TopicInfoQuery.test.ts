import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    LedgerId,
    Long,
    PrivateKey,
    Query,
    Timestamp,
    TopicId,
    TopicInfoQuery as SdkTopicInfoQuery,
    type TopicInfo,
} from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.
// Its response is plain data built from real SDK values, because TopicInfo
// has no public constructor.

const adminKey = PrivateKey.generateED25519().publicKey;
const submitKey = PrivateKey.generateED25519().publicKey;
const feeScheduleKey = PrivateKey.generateED25519().publicKey;
const exemptKey = PrivateKey.generateED25519().publicKey;

function topicInfo(overrides: Partial<TopicInfo> = {}): TopicInfo {
    return {
        topicId: TopicId.fromString("0.0.1234"),
        topicMemo: "demo topic",
        runningHash: new Uint8Array([1, 2, 3]),
        sequenceNumber: Long.fromNumber(42),
        expirationTime: Timestamp.fromDate(
            new Date("2099-01-02T03:04:05.000Z"),
        ),
        adminKey,
        submitKey,
        feeScheduleKey,
        feeExemptKeys: [exemptKey],
        autoRenewPeriod: { seconds: Long.fromNumber(7_776_000) },
        autoRenewAccountId: AccountId.fromString("0.0.555"),
        customFees: [],
        ledgerId: LedgerId.MAINNET,
        ...overrides,
    } as TopicInfo;
}

describe("TopicInfoQuery (via TopicService)", () => {
    let service: TopicService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = (call = 0) =>
        execute.mock.contexts.at(call) as SdkTopicInfoQuery;

    beforeEach(() => {
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue(topicInfo());
        service = new TopicService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("queries the topic and projects its info to a plain object", async () => {
        const info = await service.getTopicInfo("0.0.1234");

        expect(sentQuery()).toBeInstanceOf(SdkTopicInfoQuery);
        expect(sentQuery().topicId?.toString()).toBe("0.0.1234");
        // Keys pass through as the original SDK references.
        expect(info).toEqual({
            topicId: "0.0.1234",
            topicMemo: "demo topic",
            runningHash: new Uint8Array([1, 2, 3]),
            sequenceNumber: "42",
            expirationTime: "2099-01-02T03:04:05.000Z",
            adminKey,
            submitKey,
            feeScheduleKey,
            feeExemptKeys: [exemptKey],
            autoRenewPeriod: 7_776_000,
            autoRenewAccountId: "0.0.555",
            customFees: [],
            ledgerId: "mainnet",
        });
    });

    it("accepts a TopicId instance", async () => {
        const topicId = TopicId.fromString("0.0.999");
        execute.mockResolvedValueOnce(topicInfo({ topicId }));

        const info = await service.getTopicInfo(topicId);

        expect(sentQuery().topicId?.toString()).toBe("0.0.999");
        expect(info.topicId).toBe("0.0.999");
    });

    it("returns null for optional fields the network leaves unset", async () => {
        execute.mockResolvedValueOnce(
            topicInfo({
                expirationTime: null,
                adminKey: null,
                submitKey: null,
                feeScheduleKey: null,
                feeExemptKeys: null,
                autoRenewAccountId: null,
                autoRenewPeriod: null,
                customFees: null,
                ledgerId: null,
            }),
        );

        const info = await service.getTopicInfo("0.0.1234");

        expect(info.expirationTime).toBeNull();
        expect(info.adminKey).toBeNull();
        expect(info.submitKey).toBeNull();
        expect(info.feeScheduleKey).toBeNull();
        expect(info.feeExemptKeys).toBeNull();
        expect(info.autoRenewAccountId).toBeNull();
        expect(info.autoRenewPeriod).toBeNull();
        expect(info.customFees).toBeNull();
        expect(info.ledgerId).toBeNull();
    });

    it("normalises network errors with the TopicService.getTopicInfo context", async () => {
        execute.mockRejectedValueOnce(new Error("boom from network"));

        await expect(service.getTopicInfo("0.0.1234")).rejects.toMatchObject({
            name: "HieroError",
            context: "TopicService.getTopicInfo",
            message: "boom from network",
        });
    });

    it("builds a new query for every call", async () => {
        await service.getTopicInfo("0.0.1");
        await service.getTopicInfo("0.0.2");

        expect(sentQuery(0)).not.toBe(sentQuery(1));
        expect(sentQuery(1).topicId?.toString()).toBe("0.0.2");
    });
});
