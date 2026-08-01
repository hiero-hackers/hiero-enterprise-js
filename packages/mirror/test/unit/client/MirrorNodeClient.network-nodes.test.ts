import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { jsonResponse } from "../../utils/http.js";

describe("MirrorNodeClient network nodes", () => {
    let client: MirrorNodeClient;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
    });
    afterEach(() => vi.restoreAllMocks());

    it("queries /network/nodes with page controls and converts entries", async () => {
        spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                nodes: [
                    {
                        node_id: 0,
                        node_account_id: "0.0.3",
                        description: "Hosted by LG | Singapore",
                        stake: "45000000000000000",
                        min_stake: 0,
                        max_stake: 45_000_000_000_000_000,
                        stake_rewarded: 44_000_000_000_000_000,
                        stake_not_rewarded: 1_000_000_000_000_000,
                    },
                ],
                links: { next: "/api/v1/network/nodes?node.id=gt:0" },
            }),
        );

        const page = await client.queryNetworkNodes({ limit: 10 });
        expect(String(spy.mock.calls[0][0])).toBe(
            "https://x/api/v1/network/nodes?limit=10",
        );
        expect(page.data).toEqual([
            {
                nodeId: 0,
                nodeAccountId: "0.0.3",
                description: "Hosted by LG | Singapore",
                stake: "45000000000000000",
                minStake: "0",
                maxStake: "45000000000000000",
                stakeRewarded: "44000000000000000",
                stakeNotRewarded: "1000000000000000",
            },
        ]);
        expect(page.next).toBeTypeOf("function");
    });

    it("parses the staking period object on /network/stake", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                max_stake_rewarded: 1,
                max_staking_reward_rate_per_hbar: 2,
                max_total_reward: 3,
                node_reward_fee_fraction: 0,
                reserved_staking_rewards: 0,
                reward_balance_threshold: 0,
                stake_total: 100,
                staking_period: {
                    from: "1783036800.000000000",
                    to: "1783123200.000000000",
                },
                staking_period_duration: 1440,
                staking_periods_stored: 365,
                unreserved_staking_reward_balance: 0,
            }),
        );
        const stake = await client.queryNetworkStake();
        expect(stake.stakingPeriod).toEqual({
            from: "1783036800.000000000",
            to: "1783123200.000000000",
        });
    });
});
