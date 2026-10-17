import { MirrorError, MirrorErrorCodes } from "../errors/MirrorError.js";

/** Default maximum number of concurrent requests through the gate. */
export const DEFAULT_MAX_CONCURRENT = 25;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Configuration for {@link RequestGate}. */
export interface RequestGateOptions {
    /**
     * Maximum requests in flight at once. Additional requests queue and
     * start as slots free up. Must be an integer ≥ 1, or `Infinity` to
     * disable the concurrency cap. Default: {@link DEFAULT_MAX_CONCURRENT}.
     */
    maxConcurrent?: number;
    /**
     * Ceiling on the sustained request rate, in requests per second.
     * Starts are spaced by `1000 / maxRequestsPerSecond` ms. Must be > 0.
     * Default: unlimited (no spacing).
     */
    maxRequestsPerSecond?: number;
}

/**
 * Pro-active concurrency + rate limiter.
 *
 * Bounds how many operations run at once ({@link RequestGateOptions.maxConcurrent})
 * and how fast new ones may start ({@link RequestGateOptions.maxRequestsPerSecond}),
 * so a caller stays under a downstream service's limits *before* being
 * throttled rather than reacting to errors after the fact.
 *
 * This is deliberately transport-agnostic — it knows nothing about HTTP or
 * the mirror node — so it can be unit-tested in isolation and reused for any
 * rate-sensitive workload.
 */
export class RequestGate {
    private readonly maxConcurrent: number;
    private readonly minRequestIntervalMs: number;
    private active = 0;
    private readonly waiters: Array<() => void> = [];
    private nextStartAt = 0;

    constructor(options?: RequestGateOptions) {
        const maxConcurrent = options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
        if (
            maxConcurrent !== Infinity &&
            (!Number.isInteger(maxConcurrent) || maxConcurrent < 1)
        ) {
            throw new MirrorError(
                `maxConcurrent must be an integer >= 1 (or Infinity to disable), got ${maxConcurrent}.`,
                { code: MirrorErrorCodes.ConfigInvalid },
            );
        }
        this.maxConcurrent = maxConcurrent;

        const rps = options?.maxRequestsPerSecond;
        if (rps !== undefined && !(rps > 0)) {
            throw new MirrorError(
                `maxRequestsPerSecond must be a number > 0, got ${rps}.`,
                { code: MirrorErrorCodes.ConfigInvalid },
            );
        }
        this.minRequestIntervalMs = rps !== undefined ? 1000 / rps : 0;
    }

    /** Requests currently in flight. */
    get inFlight(): number {
        return this.active;
    }

    /** Requests waiting for a slot. */
    get queued(): number {
        return this.waiters.length;
    }

    /**
     * Acquire a slot, respecting the concurrency cap and rate spacing.
     * Callers MUST pair every `acquire()` with a `release()` (use
     * {@link run} to do so automatically).
     */
    async acquire(): Promise<void> {
        if (this.active >= this.maxConcurrent) {
            // `release` hands its slot straight to us, so `active` already
            // counts this request.
            await new Promise<void>((resolve) => this.waiters.push(resolve));
        } else {
            this.active++;
        }

        if (this.minRequestIntervalMs > 0) {
            const now = Date.now();
            // Reserve the next start slot synchronously (before any await) so
            // concurrent acquirers stagger instead of colliding on one instant.
            const startAt = Math.max(now, this.nextStartAt);
            this.nextStartAt = startAt + this.minRequestIntervalMs;
            const wait = startAt - now;
            if (wait > 0) await sleep(wait);
        }
    }

    /**
     * Release a slot. With a waiter queued, the slot passes to it directly,
     * so no other caller can take it before the waiter resumes.
     */
    release(): void {
        const next = this.waiters.shift();
        if (next) {
            next();
        } else {
            this.active--;
        }
    }

    /**
     * Run a task through the gate, releasing the slot when it settles.
     * One task holds exactly one slot for its whole lifetime, so internal
     * retries never re-acquire and can't deadlock the pool.
     */
    async run<T>(task: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await task();
        } finally {
            this.release();
        }
    }
}
