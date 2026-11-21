import { describe, expect, it } from "vitest";
import { LOW_RES_IMAGE_PX, lowResWarning } from "../lib/shrink-image";

describe("lowResWarning", () => {
  it("says nothing when every photo is large enough", () => {
    expect(lowResWarning([])).toBeNull();
  });

  it("names the single small photo and its size", () => {
    const w = lowResWarning([{ name: "heel-grip.jpg", px: 679 }]);
    expect(w?.title).toBe("This photo is small and will look blurry");
    expect(w?.description).toContain('"heel-grip.jpg" is 679px');
    expect(w?.description).toContain(`${LOW_RES_IMAGE_PX}px`);
  });

  it("counts several and points at the smallest", () => {
    const w = lowResWarning([
      { name: "a.jpg", px: 900 },
      { name: "b.jpg", px: 500 },
      { name: "c.jpg", px: 765 },
    ]);
    expect(w?.title).toBe("3 photos are small and will look blurry");
    expect(w?.description).toContain('Smallest: "b.jpg", 500px');
  });
});
