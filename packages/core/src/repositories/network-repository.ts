import type {
    ExchangeRates,
    NetworkStake,
    NetworkSupplies,
} from "../data/index.js";
import type { MirrorNodeClient } from "../mirror/index.js";

/**
 * Repository for querying network-level data from the mirror node.
 */
export class NetworkRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Get current and next exchange rates.
     */
    async findExchangeRates(): Promise<ExchangeRates> {
        return this.mirrorNodeClient.queryExchangeRates();
    }

    /**
     * Get network supply information.
     */
    async findNetworkSupplies(): Promise<NetworkSupplies> {
        return this.mirrorNodeClient.queryNetworkSupplies();
    }

    /**
     * Get network staking information.
     */
    async findStakingRewards(): Promise<NetworkStake> {
        return this.mirrorNodeClient.queryNetworkStake();
    }
}
