// SPDX-License-Identifier: Apache-2.0
// Browser entry for the enterprise-mirror bundle size check. It touches the
// client and every repository so tree shaking keeps what an app would use.
import {
    createMirrorRepositories,
    MirrorNodeClient,
} from "@hiero-hackers/enterprise-mirror";

const repositories = createMirrorRepositories(
    new MirrorNodeClient("https://mainnet.mirrornode.hedera.com"),
);
globalThis.hieroMirror = repositories;
