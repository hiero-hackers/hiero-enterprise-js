/**
 * Create Account — with EVM alias.
 *
 * Demonstrates the different alias strategies:
 *
 * 1. Single-key alias: ECDSA key derives both the account key and EVM alias
 * 2. Two-key alias: ED25519 controls the account, separate ECDSA key provides the alias
 * 3. Given EVM address: the address itself is the alias; its ECDSA key signs
 *
 * Aliases are immutable once set. The derived EVM address (0x...) can be used
 * in Solidity contracts and EVM tooling (MetaMask, Hardhat, etc.).
 *
 * Setup: the client is built from environment variables by
 * `resolveConfigFromEnv()` from `@hiero-hackers/enterprise-core`:
 *   HIERO_NETWORK            testnet, mainnet, previewnet, or a custom name
 *   HIERO_OPERATOR_ID        account that pays the fees, e.g. 0.0.12345
 *   HIERO_OPERATOR_KEY       the operator's private key
 *   HIERO_OPERATOR_KEY_TYPE  ed25519, ecdsa or der
 * For a custom network such as local Solo, also set HIERO_NETWORK_NODES,
 * HIERO_MIRROR_NETWORK and HIERO_MIRROR_NODE_URL.
 *
 * Run: pnpm tsx src/account/alias.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());

    const accountService = new AccountService(context);

    // Pattern 1: Single ECDSA key with alias
    // The same ECDSA key controls the account AND derives the EVM alias.
    // Simplest path for EVM-compatible accounts.
    const ecdsaKey = PrivateKey.generateECDSA();

    const aliasAccount = await accountService.createAccount({
        publicKey: ecdsaKey.publicKey.toStringRaw(),
        keyType: AccountType.ECDSA,
        alias: true, // derive EVM alias from this ECDSA key
        initialBalance: new Hbar(1),
        memo: "ECDSA account with alias",
        // The ECDSA key must sign to prove ownership of the alias address
        additionalSigners: [ecdsaKey],
    });

    console.log("1. Single-key alias");
    console.log("   Account ID:", aliasAccount.accountId);
    console.log("   EVM address:", aliasAccount.evmAddress);

    // Pattern 2: Two-key alias
    // An ED25519 key controls the account (for Hedera-native signing),
    // while a separate ECDSA key provides the EVM alias.
    // Use this when you want the security properties of ED25519 but still
    // need an EVM address for smart contract interaction.
    const controlKey = PrivateKey.generateED25519();
    const aliasKey = PrivateKey.generateECDSA();

    const twoKeyAccount = await accountService.createAccount({
        publicKey: controlKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        alias: { ecdsaPublicKey: aliasKey.publicKey.toStringRaw() },
        initialBalance: new Hbar(1),
        memo: "ED25519 account with ECDSA alias",
        // The alias ECDSA key must sign to prove ownership of the derived address
        additionalSigners: [aliasKey],
    });

    console.log("\n2. Two-key alias");
    console.log("   Account ID:", twoKeyAccount.accountId);
    console.log("   EVM address:", twoKeyAccount.evmAddress);
    console.log(
        "   Control key (ED25519):",
        controlKey.publicKey.toStringRaw(),
    );
    console.log("   Alias key (ECDSA):", aliasKey.publicKey.toStringRaw());

    // Pattern 3: Given EVM address
    // Pass the EVM address itself (40 hex characters, with or without 0x),
    // e.g. one a wallet already uses. The owner of that address's ECDSA key
    // must sign.
    const addressOwnerKey = PrivateKey.generateECDSA();
    const evmAddress = `0x${addressOwnerKey.publicKey.toEvmAddress()}`;

    const addressAccount = await accountService.createAccount({
        publicKey: controlKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        alias: evmAddress,
        initialBalance: new Hbar(1),
        memo: "ED25519 account with given EVM address",
        // The address owner's ECDSA key must sign to prove ownership
        additionalSigners: [addressOwnerKey],
    });

    console.log("\n3. Given EVM address");
    console.log("   Account ID:", addressAccount.accountId);
    console.log("   EVM address:", addressAccount.evmAddress);

    context.client.close();
}

void main();
