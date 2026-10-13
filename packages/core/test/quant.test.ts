import { describe, expect, it } from "vitest";
import { computeVolume, quantizeComponent } from "@meshquilt/core";

describe("quantizeComponent", () => {
    it.each([-1, 31, 1.5, NaN])("rejects invalid bit count %s", (bits) => {
        expect(() => quantizeComponent(0, 0, 1, bits)).toThrow();
    });
    it("snaps the same position to the same value on a shared volume", () => {
        const origin = 0;
        const range = 10;
        const left = quantizeComponent(3.1415, origin, range, 11);
        const right = quantizeComponent(3.1415, origin, range, 11);
        expect(left).toBe(right);
    });

    it("can split a shared position when each chunk uses its own volume", () => {
        const value = 5;
        const onWide = quantizeComponent(value, 0, 100, 8);
        const onTight = quantizeComponent(value, 4.9, 0.2, 8);
        expect(onWide).not.toBe(onTight);
    });
});

describe("computeVolume", () => {
    it("uses the largest axis span as the range", () => {
        const volume = computeVolume(new Float32Array([0, 0, 0, 2, 4, 1]), 3);
        expect(volume.origin).toEqual([0, 0, 0]);
        expect(volume.range).toBe(4);
    });
});
