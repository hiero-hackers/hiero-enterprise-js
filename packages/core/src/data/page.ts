/**
 * A paginated result from the mirror node REST API.
 *
 * @template T The type of items in the page
 */
export interface Page<T> {
    /** Items in this page */
    readonly data: T[];
    /** Pagination links */
    readonly links: PageLinks;
}

/**
 * Pagination links for navigating between pages.
 */
export interface PageLinks {
    /** Link to the next page (null if no more pages) */
    readonly next: string | null;
}
