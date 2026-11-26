import { describe, expect, it } from "vitest";
import { requestOrder } from "./requestOrder";

describe("requestOrder", () => {
  it("applies answers that arrive in order", () => {
    const order = requestOrder();
    const first = order.next();
    const second = order.next();

    expect(order.accept(first)).toBe(true);
    expect(order.accept(second)).toBe(true);
  });

  it("drops an older answer that arrives after a newer one", () => {
    const order = requestOrder();
    const older = order.next();
    const newer = order.next();

    expect(order.accept(newer)).toBe(true);
    expect(order.accept(older)).toBe(false);
  });

  it("keeps accepting newer reads after dropping a stale one", () => {
    const order = requestOrder();
    const a = order.next();
    const b = order.next();
    order.accept(b);
    order.accept(a);

    expect(order.accept(order.next())).toBe(true);
  });
});
