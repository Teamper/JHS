import { describe, it, expect, beforeEach } from 'vitest';

// --- Circuit breaker implementation (extracted from src/core/http.js) ---

class CircuitBreakerManager {
    constructor() {
        this._circuitBreakers = new Map();
        this._domainStats = new Map();
    }

    _getDomain(e) {
        try { return new URL(e).hostname; } catch { return "unknown"; }
    }

    _checkCircuitBreaker(e) {
        const t = this._circuitBreakers.get(e);
        if (!t) return null;
        if ("open" === t.state) {
            const n = Date.now() - t.openTime;
            return n < t.cooldownMs ? { state: "open", remaining: Math.ceil((t.cooldownMs - n) / 1e3) } : (t.state = "half-open", t.failCount = 0, t.probing = !1, null);
        }
        if ("half-open" === t.state && t.probing) return { state: "half-open", remaining: 0 };
        return null;
    }

    isDomainCircuitBroken(e) {
        return this._checkCircuitBreaker(this._getDomain(e));
    }

    _recordSuccess(e) {
        let t = this._circuitBreakers.get(e);
        t && (t.state = "closed", t.failCount = 0, t.probing = !1);
        let n = this._domainStats.get(e);
        n || (n = { count: 0, errors: 0, lastUsed: 0 }, this._domainStats.set(e, n)), n.count++, n.lastUsed = Date.now();
    }

    _recordFailure(e) {
        let t = this._circuitBreakers.get(e);
        t || (t = { state: "closed", failCount: 0, openTime: 0, cooldownMs: 6e4, threshold: 3 }, this._circuitBreakers.set(e, t)),
        t.failCount++, t.failCount >= (t.threshold || 3) && (t.state = "open", t.openTime = Date.now());
        let n = this._domainStats.get(e);
        n || (n = { count: 0, errors: 0, lastUsed: 0 }, this._domainStats.set(e, n)), n.count++, n.errors++, n.lastUsed = Date.now();
    }

    getCircuitBreakerStatus() {
        const e = {};
        return this._circuitBreakers.forEach(((t, n) => {
            e[n] = { ...t };
        })), e;
    }

    getDomainStats() {
        const e = {};
        return this._domainStats.forEach(((t, n) => {
            e[n] = { ...t };
        })), e;
    }

    resetCircuitBreaker(e) {
        this._circuitBreakers.delete(e);
    }

    resetAllCircuitBreakers() {
        this._circuitBreakers.clear();
    }

    clearDomainStats() {
        this._domainStats.clear();
    }
}

// --- Tests ---

describe('Circuit Breaker', () => {
    let cbm;

    beforeEach(() => {
        cbm = new CircuitBreakerManager();
    });

    describe('_getDomain', () => {
        it('should extract hostname from URL', () => {
            expect(cbm._getDomain('https://example.com/path')).toBe('example.com');
            expect(cbm._getDomain('https://sub.domain.com:8080/path')).toBe('sub.domain.com');
        });

        it('should return "unknown" for invalid URLs', () => {
            expect(cbm._getDomain('not-a-url')).toBe('unknown');
        });
    });

    describe('_checkCircuitBreaker', () => {
        it('should return null for unknown domain', () => {
            expect(cbm._checkCircuitBreaker('unknown.com')).toBe(null);
        });

        it('should return null for closed state', () => {
            cbm._circuitBreakers.set('test.com', { state: 'closed', failCount: 0, openTime: 0, cooldownMs: 60000, threshold: 3 });
            expect(cbm._checkCircuitBreaker('test.com')).toBe(null);
        });

        it('should return "open" with remaining seconds when cooldown not expired', () => {
            cbm._circuitBreakers.set('test.com', {
                state: 'open',
                failCount: 3,
                openTime: Date.now() - 10000, // 10 seconds ago
                cooldownMs: 60000,
                threshold: 3
            });
            const result = cbm._checkCircuitBreaker('test.com');
            expect(result).not.toBeNull();
            expect(result.state).toBe('open');
            expect(result.remaining).toBeGreaterThan(0);
            expect(result.remaining).toBeLessThanOrEqual(50);
        });

        it('should transition to half-open when cooldown expires', () => {
            cbm._circuitBreakers.set('test.com', {
                state: 'open',
                failCount: 3,
                openTime: Date.now() - 70000, // 70 seconds ago (cooldown was 60s)
                cooldownMs: 60000,
                threshold: 3
            });
            const result = cbm._checkCircuitBreaker('test.com');
            expect(result).toBe(null);
            expect(cbm._circuitBreakers.get('test.com').state).toBe('half-open');
        });

        it('should block half-open when probing', () => {
            cbm._circuitBreakers.set('test.com', {
                state: 'half-open',
                failCount: 0,
                openTime: 0,
                cooldownMs: 60000,
                threshold: 3,
                probing: true
            });
            const result = cbm._checkCircuitBreaker('test.com');
            expect(result).not.toBeNull();
            expect(result.state).toBe('half-open');
        });

        it('should allow half-open when not probing', () => {
            cbm._circuitBreakers.set('test.com', {
                state: 'half-open',
                failCount: 0,
                openTime: 0,
                cooldownMs: 60000,
                threshold: 3,
                probing: false
            });
            expect(cbm._checkCircuitBreaker('test.com')).toBe(null);
        });
    });

    describe('_recordFailure', () => {
        it('should create circuit breaker entry on first failure', () => {
            cbm._recordFailure('test.com');
            const entry = cbm._circuitBreakers.get('test.com');
            expect(entry).toBeDefined();
            expect(entry.failCount).toBe(1);
            expect(entry.state).toBe('closed');
        });

        it('should increment fail count', () => {
            cbm._recordFailure('test.com');
            cbm._recordFailure('test.com');
            expect(cbm._circuitBreakers.get('test.com').failCount).toBe(2);
        });

        it('should open circuit when threshold reached', () => {
            cbm._recordFailure('test.com');
            cbm._recordFailure('test.com');
            cbm._recordFailure('test.com');
            const entry = cbm._circuitBreakers.get('test.com');
            expect(entry.state).toBe('open');
            expect(entry.failCount).toBe(3);
        });

        it('should track domain stats', () => {
            cbm._recordFailure('test.com');
            const stats = cbm._domainStats.get('test.com');
            expect(stats.count).toBe(1);
            expect(stats.errors).toBe(1);
        });
    });

    describe('_recordSuccess', () => {
        it('should reset circuit breaker on success', () => {
            cbm._circuitBreakers.set('test.com', { state: 'half-open', failCount: 1, openTime: 0, cooldownMs: 60000, threshold: 3, probing: true });
            cbm._recordSuccess('test.com');
            const entry = cbm._circuitBreakers.get('test.com');
            expect(entry.state).toBe('closed');
            expect(entry.failCount).toBe(0);
            expect(entry.probing).toBe(false);
        });

        it('should track domain stats', () => {
            cbm._recordSuccess('test.com');
            const stats = cbm._domainStats.get('test.com');
            expect(stats.count).toBe(1);
            expect(stats.errors).toBe(0);
        });
    });

    describe('isDomainCircuitBroken (integration)', () => {
        it('should return null for healthy domain', () => {
            expect(cbm.isDomainCircuitBroken('https://test.com/api')).toBe(null);
        });

        it('should block after threshold failures', () => {
            cbm._recordFailure('test.com');
            cbm._recordFailure('test.com');
            cbm._recordFailure('test.com');
            const result = cbm.isDomainCircuitBroken('https://test.com/api');
            expect(result).not.toBeNull();
            expect(result.state).toBe('open');
        });

        it('should recover after success', () => {
            cbm._recordFailure('test.com');
            cbm._recordFailure('test.com');
            cbm._recordFailure('test.com');
            // Manually set to half-open (simulating cooldown expired)
            cbm._circuitBreakers.get('test.com').state = 'half-open';
            cbm._recordSuccess('test.com');
            expect(cbm.isDomainCircuitBroken('https://test.com/api')).toBe(null);
        });
    });

    describe('reset methods', () => {
        it('resetCircuitBreaker should remove specific domain', () => {
            cbm._recordFailure('a.com');
            cbm._recordFailure('b.com');
            cbm.resetCircuitBreaker('a.com');
            expect(cbm._circuitBreakers.has('a.com')).toBe(false);
            expect(cbm._circuitBreakers.has('b.com')).toBe(true);
        });

        it('resetAllCircuitBreakers should clear all', () => {
            cbm._recordFailure('a.com');
            cbm._recordFailure('b.com');
            cbm.resetAllCircuitBreakers();
            expect(cbm._circuitBreakers.size).toBe(0);
        });

        it('clearDomainStats should clear all stats', () => {
            cbm._recordSuccess('a.com');
            cbm._recordFailure('b.com');
            cbm.clearDomainStats();
            expect(cbm._domainStats.size).toBe(0);
        });
    });

    describe('getCircuitBreakerStatus / getDomainStats', () => {
        it('should return copies of internal state', () => {
            cbm._recordFailure('test.com');
            const status = cbm.getCircuitBreakerStatus();
            expect(status['test.com']).toBeDefined();
            expect(status['test.com'].failCount).toBe(1);
            // Should be a copy, not a reference
            status['test.com'].failCount = 999;
            expect(cbm._circuitBreakers.get('test.com').failCount).toBe(1);
        });

        it('should return domain stats', () => {
            cbm._recordSuccess('test.com');
            cbm._recordSuccess('test.com');
            cbm._recordFailure('test.com');
            const stats = cbm.getDomainStats();
            expect(stats['test.com'].count).toBe(3);
            expect(stats['test.com'].errors).toBe(1);
        });
    });
});
