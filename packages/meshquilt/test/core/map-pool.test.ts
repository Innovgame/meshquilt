import { expect, it } from "vitest";
import { mapPool } from "meshquilt";

it("pulls lazy work only when a concurrency slot is available", async () => {
    let produced = 0;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
        finish = resolve;
    });
    function* jobs() {
        for (let index = 0; index < 10; index++) {
            produced++;
            yield index;
        }
    }
    const result = mapPool(jobs(), 2, async (index) => {
        await gate;
        return index;
    });
    await Promise.resolve();
    expect(produced).toBe(2);
    finish();
    await expect(result).resolves.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

it("stops taking new work on failure and settles in-flight work before rejecting", async () => {
    const started: number[] = [];
    let completeSecond!: () => void;
    const second = new Promise<void>((resolve) => {
        completeSecond = resolve;
    });
    const error = new Error("encoder failed");
    let returned = false;
    const result = mapPool([0, 1, 2, 3], 2, async (_item, index) => {
        started.push(index);
        if (index === 0) throw error;
        await second;
        return index;
    });
    const settled = result.then(
        () => {
            returned = true;
        },
        () => {
            returned = true;
        }
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(returned).toBe(false);
    completeSecond();
    await expect(result).rejects.toBe(error);
    await settled;
    expect(started).toEqual([0, 1]);
});

it("preserves input order when tasks complete out of order", async () => {
    const result = await mapPool([0, 1, 2], 2, async (value) => {
        await new Promise((resolve) => setTimeout(resolve, value === 0 ? 5 : 0));
        return value + 10;
    });
    expect(result).toEqual([10, 11, 12]);
});

it("closes lazy producers and stops scheduling after cancellation", async () => {
    const controller = new AbortController();
    const visited: number[] = [];
    let closed = false;
    function* jobs() {
        try {
            yield 0;
            yield 1;
            yield 2;
        } finally {
            closed = true;
        }
    }
    await expect(
        mapPool(
            jobs(),
            1,
            (item) => {
                visited.push(item);
                controller.abort();
                return item;
            },
            { signal: controller.signal }
        )
    ).rejects.toThrow(/aborted/);
    expect(visited).toEqual([0]);
    expect(closed).toBe(true);
});
