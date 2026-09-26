import { describe, expect, it } from "vitest";
import { classify, isEscalation, validateLimits, worstStatus } from "./severity";

const water = { warning: 60, danger: 80, direction: "above" as const };
const pressure = { warning: 1000, danger: 990, direction: "below" as const };

describe("classify", () => {
  it("classifies rising values", () => {
    expect(classify(28, water)).toBe("normal");
    expect(classify(60, water)).toBe("warning");
    expect(classify(79.9, water)).toBe("warning");
    expect(classify(80, water)).toBe("danger");
  });
  it("classifies falling values", () => {
    expect(classify(1012, pressure)).toBe("normal");
    expect(classify(1000, pressure)).toBe("warning");
    expect(classify(985, pressure)).toBe("danger");
  });
  it("is unknown without limits", () => {
    expect(classify(50, undefined)).toBe("unknown");
    expect(classify(50, { warning: null, danger: null, direction: "above" })).toBe("unknown");
  });
});

describe("isEscalation", () => {
  it("alerts only on upward moves into warning/danger", () => {
    expect(isEscalation("normal", "warning")).toBe(true);
    expect(isEscalation("warning", "danger")).toBe(true);
    expect(isEscalation("unknown", "danger")).toBe(true);
    expect(isEscalation("danger", "warning")).toBe(false);
    expect(isEscalation("warning", "warning")).toBe(false);
    expect(isEscalation("danger", "normal")).toBe(false);
  });
});

describe("helpers", () => {
  it("worstStatus", () => {
    expect(worstStatus(["normal", "danger", "warning"])).toBe("danger");
    expect(worstStatus([])).toBe("unknown");
  });
  it("validateLimits", () => {
    expect(validateLimits(water)).toBeNull();
    expect(validateLimits({ ...water, danger: 50 })).not.toBeNull();
    expect(validateLimits(pressure)).toBeNull();
  });
});
