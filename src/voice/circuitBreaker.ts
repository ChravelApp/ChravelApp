
/**
 * Circuit breaker to prevent infinite reconnect loops.
 *
 * States:
 *   closed   → healthy, requests allowed
 *   open     → too many failures, requests blocked
 *   half-open → cooldown expired, one probe request allowed
 *
 * Persists to localStorage so state survives page refreshes.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

interface StoredState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  openedAt: number;
}

const STORAGE_KEY = 'chavel_voice_circuit_breaker';
const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS = 30 * 1000; // 30 seconds before half-open
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours — auto-reset

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number[] = []; // timestamps of recent failures
  private openedAt = 0;

  constructor() {
    this.loadFromStorage();
  }

  /** Whether a request is currently allowed */
  canRequest(): boolean {
    this.pruneOldFailures();
    this.maybeTransition();

    if (this.state === 'closed') return true;
    if (this.state === 'half-open') return true; // allow one probe
    return false; // open
  }

  /** Record a successful request — resets to closed */
  recordSuccess(): void {
    this.state = 'closed';
    this.failures = [];
    this.openedAt = 0;
    this.persist();
  }

  /** Record a failed request — may open the circuit */
  recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.pruneOldFailures();

    if (this.state === 'half-open') {
      // Probe failed — reopen
      this.state = 'open';
      this.openedAt = now;
    } else if (this.failures.length >= FAILURE_THRESHOLD) {
      this.state = 'open';
      this.openedAt = now;
    }

    this.persist();
  }

  /** Get current circuit state */
  getState(): CircuitState {
    this.maybeTransition();
    return this.state;
  }

  /** Force reset (e.g., user manually retries) */
  reset(): void {
    this.state = 'closed';
    this.failures = [];
    this.openedAt = 0;
    this.persist();
  }

  private pruneOldFailures(): void {
    const cutoff = Date.now() - FAILURE_WINDOW_MS;
    this.failures = this.failures.filter((t) => t > cutoff);
  }

  private maybeTransition(): void {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= EXPIRY_MS) {
        // Auto-reset after 24h
        this.reset();
      } else if (elapsed >= COOLDOWN_MS) {
        this.state = 'half-open';
        this.persist();
      }
    }
  }

  private persist(): void {
    try {
      const data: StoredState = {
        state: this.state,
        failures: this.failures.length,
        lastFailureTime: this.failures[this.failures.length - 1] || 0,
        openedAt: this.openedAt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage unavailable — no-op
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data: StoredState = JSON.parse(raw);

      // Check expiry
      if (data.openedAt && Date.now() - data.openedAt >= EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      this.state = data.state;
      this.openedAt = data.openedAt;
      // Reconstruct approximate failure timestamps
      if (data.lastFailureTime && data.failures > 0) {
        this.failures = Array(data.failures).fill(data.lastFailureTime);
      }
    } catch {
      // Corrupted data — start fresh
    }
  }
}
