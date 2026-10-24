/**
 * Create Account — with EVM alias.
 *
 * Demonstrates the different alias strategies:
 *
 * 1. Single-key alias: ECDSA key derives both the account key and EVM alias
 * 2. Two-key alias: ED25519 controls the account, separate ECDSA key provides the alias
 *
 * Aliases are immutable once set. The derived EVM address (0x...) can be used
 * in Solidity contracts and EVM tooling (MetaMask, Hardhat, etc.).
 *
 * Run: pnpm tsx src/account/alias.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());

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

    context.client.close();
}

void main();
