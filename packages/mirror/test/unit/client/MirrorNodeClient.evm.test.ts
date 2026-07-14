import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { jsonResponse } from "../../utils/http.js";

/**
 * The spec-completion endpoints: blocks, hooks, registered nodes, topic
 * message by timestamp, and the full contracts/EVM family — URL exactness
 * plus response conversion for each, and the POST semantics of
 * `/contracts/call`.
 */
describe("MirrorNodeClient EVM + spec-completion endpoints", () => {
    let client: MirrorNodeClient;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
    });
    afterEach(() => vi.restoreAllMocks());

    const url = () => String(spy.mock.calls.at(-1)?.[0]);
    const init = () =>
        spy.mock.calls.at(-1)?.[1] as {
            method?: string;
            headers?: Record<string, string>;
            body?: string;
        };
    const mockJson = (body: unknown) => {
        spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(jsonResponse(body));
    };

    describe("blocks", () => {
        const rawBlock = {
            count: 3,
            gas_used: 300000,
            hapi_version: "0.11.0",
            hash: "0x3c08bb",
            logs_bloom: "0x00",
            name: "2022-05-03T06_46_26.060890949Z.rcd",
            number: 77,
            previous_hash: "0xf7d648",
            size: 8192,
            timestamp: {
                from: "1651560386.060890949",
                to: "1651560386.661997287",
            },
        };

        it("lists with height/time filters and converts", async () => {
            mockJson({ blocks: [rawBlock], links: { next: null } });
            const page = await client.queryBlocks({
                blockNumber: { gte: 70 },
                limit: 5,
                order: "desc",
            });
            expect(url()).toBe(
                "https://x/api/v1/blocks?block.number=gte:70&limit=5&order=desc",
            );
            expect(page.data[0]).toEqual({
                count: 3,
                gasUsed: 300000,
                hapiVersion: "0.11.0",
                hash: "0x3c08bb",
                logsBloom: "0x00",
                name: "2022-05-03T06_46_26.060890949Z.rcd",
                number: 77,
                previousHash: "0xf7d648",
                size: 8192,
                timestamp: {
                    from: "1651560386.060890949",
                    to: "1651560386.661997287",
                },
            });
        });

        it("fetches one block by number", async () => {
            mockJson(rawBlock);
            const block = await client.queryBlock(77);
            expect(url()).toBe("https://x/api/v1/blocks/77");
            expect(block.number).toBe(77);
        });

        it("rejects a block payload without a hash", async () => {
            mockJson({ number: 77 });
            await expect(client.queryBlock(77)).rejects.toThrow(
                /schema mismatch/,
            );
        });
    });

    describe("hooks", () => {
        it("lists an account's hooks and converts", async () => {
            mockJson({
                hooks: [
                    {
                        admin_key: { key: "ak" },
                        contract_id: "0.0.5001",
                        created_timestamp: "1.0",
                        deleted: false,
                        extension_point: "ACCOUNT_ALLOWANCE_HOOK",
                        hook_id: 1,
                        owner_id: "0.0.15",
                        timestamp_range: { from: "1.0", to: null },
                        type: "EVM",
                    },
                ],
                links: { next: null },
            });
            const page = await client.queryHooks("0.0.15", {
                hookId: { gte: 1 },
                limit: 10,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.15/hooks?hook.id=gte:1&limit=10",
            );
            expect(page.data[0]).toEqual({
                adminKey: { key: "ak" },
                contractId: "0.0.5001",
                createdTimestamp: "1.0",
                deleted: false,
                extensionPoint: "ACCOUNT_ALLOWANCE_HOOK",
                hookId: 1,
                ownerId: "0.0.15",
                timestampRange: { from: "1.0", to: null },
                type: "EVM",
            });
        });

        it("lists a hook's storage slots", async () => {
            mockJson({
                hook_id: 1,
                owner_id: "0.0.15",
                storage: [{ key: "0x0f", value: "0xff", timestamp: "1.0" }],
                links: { next: null },
            });
            const page = await client.queryHookStorage("0.0.15", 1, {
                key: "0x0f",
                limit: 2,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.15/hooks/1/storage?key=0x0f&limit=2",
            );
            expect(page.data[0]).toEqual({
                key: "0x0f",
                value: "0xff",
                timestamp: "1.0",
            });
        });
    });

    describe("registered nodes", () => {
        it("lists with id/type filters and converts", async () => {
            mockJson({
                registered_nodes: [
                    {
                        admin_key: { key: "nk" },
                        created_timestamp: "1.0",
                        description: "alpha",
                        registered_node_id: 1,
                        service_endpoints: [
                            {
                                ip_address: "128.0.0.6",
                                port: 50216,
                                requires_tls: true,
                                type: "BLOCK_NODE",
                            },
                        ],
                        timestamp: { from: "1.0", to: null },
                    },
                ],
                links: { next: null },
            });
            const page = await client.queryRegisteredNodes({
                registeredNodeId: 1,
                type: "BLOCK_NODE",
            });
            expect(url()).toBe(
                "https://x/api/v1/network/registered-nodes" +
                    "?registerednode.id=1&type=BLOCK_NODE",
            );
            expect(page.data[0]).toEqual({
                adminKey: { key: "nk" },
                createdTimestamp: "1.0",
                description: "alpha",
                registeredNodeId: 1,
                serviceEndpoints: [
                    {
                        ipAddress: "128.0.0.6",
                        port: 50216,
                        requiresTls: true,
                        type: "BLOCK_NODE",
                    },
                ],
                timestamp: { from: "1.0", to: null },
            });
        });
    });

    describe("topic message by timestamp", () => {
        it("fetches a message with no topic ID", async () => {
            mockJson({
                topic_id: "0.0.7",
                sequence_number: 5,
                message: "bQ==",
                running_hash: "aA==",
                consensus_timestamp: "1234.000000001",
                payer_account_id: "0.0.2",
            });
            const message =
                await client.queryTopicMessageByTimestamp("1234.000000001");
            expect(url()).toBe(
                "https://x/api/v1/topics/messages/1234.000000001",
            );
            expect(message.topicId).toBe("0.0.7");
            expect(message.sequenceNumber).toBe("5");
        });
    });

    describe("contracts", () => {
        const rawContract = {
            admin_key: { key: "ck" },
            auto_renew_account: "0.0.2",
            auto_renew_period: 7776000,
            contract_id: "0.0.5001",
            created_timestamp: "1.0",
            deleted: false,
            evm_address: "0x0000000000000000000000000000000000001389",
            expiration_timestamp: null,
            file_id: "0.0.5000",
            max_automatic_token_associations: 0,
            memo: "contract memo",
            nonce: 1,
            obtainer_id: null,
            permanent_removal: null,
            timestamp: { from: "1.0", to: null },
        };

        it("lists with contract.id filter and converts", async () => {
            mockJson({ contracts: [rawContract], links: { next: null } });
            const page = await client.queryContracts({
                contractId: { gte: "0.0.5000" },
                limit: 2,
            });
            expect(url()).toBe(
                "https://x/api/v1/contracts?contract.id=gte:0.0.5000&limit=2",
            );
            expect(page.data[0]).toEqual({
                adminKey: { key: "ck" },
                autoRenewAccount: "0.0.2",
                autoRenewPeriod: 7776000,
                contractId: "0.0.5001",
                createdTimestamp: "1.0",
                deleted: false,
                evmAddress: "0x0000000000000000000000000000000000001389",
                expirationTimestamp: null,
                fileId: "0.0.5000",
                maxAutomaticTokenAssociations: 0,
                memo: "contract memo",
                nonce: 1,
                obtainerId: null,
                proxyAccountId: null,
                permanentRemoval: null,
                timestamp: { from: "1.0", to: null },
            });
        });

        it("fetches one contract with bytecode", async () => {
            mockJson({
                ...rawContract,
                bytecode: "0x0102",
                runtime_bytecode: "0x0302",
            });
            const contract = await client.queryContract("0.0.5001", {
                timestamp: "2.0",
            });
            expect(url()).toBe(
                "https://x/api/v1/contracts/0.0.5001?timestamp=2.0",
            );
            expect(contract.bytecode).toBe("0x0102");
            expect(contract.runtimeBytecode).toBe("0x0302");
        });

        it("rejects a contract payload without contract_id", async () => {
            mockJson({ memo: "nope" });
            await expect(client.queryContract("0.0.5001")).rejects.toThrow(
                /schema mismatch/,
            );
        });
    });

    describe("contract results", () => {
        const rawResult = {
            amount: 10,
            block_gas_used: 2000,
            block_hash: "0x6ceecd",
            block_number: 10,
            bloom: "0x0",
            call_result: "0x2b04",
            chain_id: "0x127",
            contract_id: "0.0.5001",
            created_contract_ids: ["0.0.7001"],
            error_message: null,
            from: "0x0000000000000000000000000000000000001f41",
            function_parameters: "0xbb9f02dc",
            gas_consumed: 35000,
            gas_limit: 100000,
            gas_price: "0x4a817c800",
            gas_used: 80000,
            hash: "0xfebbaa",
            max_fee_per_gas: "0x5",
            max_priority_fee_per_gas: "0x100",
            nonce: 1,
            result: "SUCCESS",
            status: "0x1",
            timestamp: "12.0",
            to: "0x0000000000000000000000000000000000001389",
            transaction_index: 1,
            type: 2,
        };

        it("lists one contract's results with every filter", async () => {
            mockJson({ results: [rawResult], links: { next: null } });
            const page = await client.queryContractResults("0.0.5001", {
                blockNumber: 10,
                from: "0.0.8001",
                internal: false,
                timestamp: { gte: "1.0" },
                transactionIndex: 1,
                limit: 3,
                order: "asc",
            });
            expect(url()).toBe(
                "https://x/api/v1/contracts/0.0.5001/results" +
                    "?block.number=10&from=0.0.8001&internal=false" +
                    "&timestamp=gte:1.0&transaction.index=1&limit=3&order=asc",
            );
            expect(page.data[0].gasUsed).toBe(80000);
            expect(page.data[0].createdContractIds).toEqual(["0.0.7001"]);
        });

        it("lists results across all contracts", async () => {
            mockJson({ results: [], links: { next: null } });
            await client.queryAllContractResults({ limit: 1 });
            expect(url()).toBe("https://x/api/v1/contracts/results?limit=1");
        });

        it("fetches a detailed result by contract + timestamp", async () => {
            mockJson({
                ...rawResult,
                logs: [
                    {
                        address: "0xddf2",
                        bloom: "0x1",
                        contract_id: "0.0.5001",
                        data: "0x00fa",
                        index: 0,
                        topics: ["0xf475"],
                    },
                ],
                state_changes: [
                    {
                        address: "0xddf2",
                        contract_id: "0.0.5001",
                        slot: "0x00fa",
                        value_read: "0x97c1",
                        value_written: null,
                    },
                ],
            });
            const details = await client.queryContractResultByTimestamp(
                "0.0.5001",
                "12.0",
            );
            expect(url()).toBe(
                "https://x/api/v1/contracts/0.0.5001/results/12.0",
            );
            expect(details.logs).toEqual([
                {
                    address: "0xddf2",
                    bloom: "0x1",
                    contractId: "0.0.5001",
                    data: "0x00fa",
                    index: 0,
                    topics: ["0xf475"],
                },
            ]);
            expect(details.stateChanges).toEqual([
                {
                    address: "0xddf2",
                    contractId: "0.0.5001",
                    slot: "0x00fa",
                    valueRead: "0x97c1",
                    valueWritten: null,
                },
            ]);
        });

        it("fetches a detailed result by hash with a nonce", async () => {
            mockJson(rawResult);
            const details = await client.queryContractResult("0xfebbaa", {
                nonce: 1,
            });
            expect(url()).toBe(
                "https://x/api/v1/contracts/results/0xfebbaa?nonce=1",
            );
            expect(details.result).toBe("SUCCESS");
            expect(details.logs).toEqual([]);
        });

        it("rejects a result payload without result", async () => {
            mockJson({ hash: "0xfebbaa" });
            await expect(
                client.queryContractResult("0xfebbaa"),
            ).rejects.toThrow(/schema mismatch/);
        });
    });

    describe("contract actions and opcodes", () => {
        it("lists an execution's call frames", async () => {
            mockJson({
                actions: [
                    {
                        call_depth: 1,
                        call_operation_type: "CALL",
                        call_type: "CALL",
                        caller: "0.0.8001",
                        caller_type: "ACCOUNT",
                        from: "0x0000000000000000000000000000000000001f41",
                        gas: 50000,
                        gas_used: 20000,
                        index: 0,
                        input: "0x1234",
                        recipient: "0.0.5001",
                        recipient_type: "CONTRACT",
                        result_data: "0x5678",
                        result_data_type: "OUTPUT",
                        timestamp: "12.0",
                        to: "0x0000000000000000000000000000000000001389",
                        value: 0,
                    },
                ],
                links: { next: null },
            });
            const page = await client.queryContractActions("0xfebbaa", {
                index: { gte: 0 },
                limit: 5,
            });
            expect(url()).toBe(
                "https://x/api/v1/contracts/results/0xfebbaa/actions" +
                    "?index=gte:0&limit=5",
            );
            expect(page.data[0]).toEqual({
                callDepth: 1,
                callOperationType: "CALL",
                callType: "CALL",
                caller: "0.0.8001",
                callerType: "ACCOUNT",
                from: "0x0000000000000000000000000000000000001f41",
                gas: 50000,
                gasUsed: 20000,
                index: 0,
                input: "0x1234",
                recipient: "0.0.5001",
                recipientType: "CONTRACT",
                resultData: "0x5678",
                resultDataType: "OUTPUT",
                timestamp: "12.0",
                to: "0x0000000000000000000000000000000000001389",
                value: 0,
            });
        });

        it("fetches an opcode trace with detail switches", async () => {
            mockJson({
                address: "0x0000000000000000000000000000000000001389",
                contract_id: "0.0.5001",
                failed: false,
                gas: 80000,
                opcodes: [
                    {
                        depth: 1,
                        gas: 2731,
                        gas_cost: 3,
                        memory: ["0x00"],
                        op: "PUSH1",
                        pc: 0,
                        reason: null,
                        stack: ["0x80"],
                        storage: { "0x00": "0x01" },
                    },
                ],
                return_value: "0x01",
            });
            const trace = await client.queryContractOpcodes("0xfebbaa", {
                stack: false,
                memory: true,
                storage: true,
            });
            expect(url()).toBe(
                "https://x/api/v1/contracts/results/0xfebbaa/opcodes" +
                    "?stack=false&memory=true&storage=true",
            );
            expect(trace.failed).toBe(false);
            expect(trace.opcodes[0]).toEqual({
                depth: 1,
                gas: 2731,
                gasCost: 3,
                memory: ["0x00"],
                op: "PUSH1",
                pc: 0,
                reason: null,
                stack: ["0x80"],
                storage: { "0x00": "0x01" },
            });
        });

        it("rejects an opcode payload without an opcodes array", async () => {
            mockJson({ gas: 1 });
            await expect(
                client.queryContractOpcodes("0xfebbaa"),
            ).rejects.toThrow(/expected opcodes array/);
        });
    });

    describe("contract state and logs", () => {
        it("lists storage slots with slot/time filters", async () => {
            mockJson({
                state: [
                    {
                        address: "0x0000000000000000000000000000000000001389",
                        contract_id: "0.0.5001",
                        timestamp: "12.0",
                        slot: "0x00fa",
                        value: "0x8c5b",
                    },
                ],
                links: { next: null },
            });
            const page = await client.queryContractState("0.0.5001", {
                slot: "0x00fa",
                timestamp: "12.0",
                limit: 1,
            });
            expect(url()).toBe(
                "https://x/api/v1/contracts/0.0.5001/state" +
                    "?slot=0x00fa&timestamp=12.0&limit=1",
            );
            expect(page.data[0]).toEqual({
                address: "0x0000000000000000000000000000000000001389",
                contractId: "0.0.5001",
                timestamp: "12.0",
                slot: "0x00fa",
                value: "0x8c5b",
            });
        });

        const rawLog = {
            address: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f1",
            bloom: "0x1",
            block_hash: "0x553f93",
            block_number: 10,
            contract_id: "0.0.5001",
            data: "0x00fa",
            index: 0,
            root_contract_id: "0.0.5001",
            timestamp: "12.0",
            topics: ["0xf4757a49"],
            transaction_hash: "0x397022",
            transaction_index: 1,
        };

        it("searches one contract's logs by topic within a window", async () => {
            mockJson({ logs: [rawLog], links: { next: null } });
            const page = await client.queryContractLogs("0.0.5001", {
                timestamp: { gte: "1.0", lte: "2.0" },
                topic0: "0xf4757a49",
                limit: 10,
            });
            expect(url()).toBe(
                "https://x/api/v1/contracts/0.0.5001/results/logs" +
                    "?timestamp=gte:1.0&timestamp=lte:2.0" +
                    "&topic0=0xf4757a49&limit=10",
            );
            expect(page.data[0]).toEqual({
                address: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f1",
                bloom: "0x1",
                blockHash: "0x553f93",
                blockNumber: 10,
                contractId: "0.0.5001",
                data: "0x00fa",
                index: 0,
                rootContractId: "0.0.5001",
                timestamp: "12.0",
                topics: ["0xf4757a49"],
                transactionHash: "0x397022",
                transactionIndex: 1,
            });
        });

        it("searches logs network-wide by transaction hash", async () => {
            mockJson({ logs: [], links: { next: null } });
            await client.queryAllContractLogs({
                transactionHash: "0x397022",
            });
            expect(url()).toBe(
                "https://x/api/v1/contracts/results/logs" +
                    "?transaction.hash=0x397022",
            );
        });
    });

    describe("contract call (POST)", () => {
        it("POSTs the JSON call request and converts the result", async () => {
            mockJson({ result: "0x0000000000006d8d" });
            const outcome = await client.queryContractCall({
                to: "0xd9d0c5c0ff85758bdf05a7636f8036d4d065f5b6",
                data: "0x47f1aae7",
                estimate: false,
                gas: 15000000,
            });
            expect(url()).toBe("https://x/api/v1/contracts/call");
            expect(init().method).toBe("POST");
            expect(init().headers).toEqual({
                "content-type": "application/json",
            });
            expect(JSON.parse(String(init().body))).toEqual({
                to: "0xd9d0c5c0ff85758bdf05a7636f8036d4d065f5b6",
                data: "0x47f1aae7",
                estimate: false,
                gas: 15000000,
            });
            expect(outcome).toEqual({ result: "0x0000000000006d8d" });
        });

        it("rejects a call payload without a result", async () => {
            mockJson({});
            await expect(
                client.queryContractCall({ to: "0xd9d0" }),
            ).rejects.toThrow(/schema mismatch/);
        });
    });
});
