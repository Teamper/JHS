import { describe, it, expect } from "vitest";
import { diffPortableData as diffData } from "../src/services/portable-backup-service.js";

describe('diffData', () => {
    it('should return unchanged for identical data', () => {
        const data = {
            car_list: [{ carNum: 'A001', val: 1 }],
            blacklist: [{ starId: 'S001', name: 'test' }],
        };
        const result = diffData(data, { ...data });
        expect(result.summary.unchanged).toBe(2);
        expect(result.summary.modified).toBe(0);
    });

    it('should detect added stores', () => {
        const old = { car_list: [] };
        const fresh = { car_list: [], blacklist: [] };
        const result = diffData(old, fresh);
        expect(result.stores.blacklist.status).toBe('added');
        expect(result.summary.added).toBe(1);
    });

    it('should detect removed stores', () => {
        const old = { car_list: [], blacklist: [] };
        const fresh = { car_list: [] };
        const result = diffData(old, fresh);
        expect(result.stores.blacklist.status).toBe('removed');
        expect(result.summary.removed).toBe(1);
    });

    it('should detect modified stores', () => {
        const old = { car_list: [{ carNum: 'A001', val: 1 }] };
        const fresh = { car_list: [{ carNum: 'A001', val: 99 }] };
        const result = diffData(old, fresh);
        expect(result.stores.car_list.status).toBe('modified');
        expect(result.summary.modified).toBe(1);
    });
});
