import { describe, it, expect } from "vitest";
import { exerciseId, embedUrl, parseLibraryList, videoLookup } from "./exercises";

describe("exercises", () => {
  it("exerciseId ignores case, spaces and punctuation", () => {
    expect(exerciseId("Bulgarian Split Squat")).toBe("bulgarian-split-squat");
    expect(exerciseId("  bulgarian  split squat! ")).toBe("bulgarian-split-squat");
    expect(exerciseId("Marklyft (rak stång)")).toBe("marklyft-rak-stång");
    expect(exerciseId("???")).toBe("exercise");
  });

  it("embedUrl: Drive file links in several forms", () => {
    const want = "https://drive.google.com/file/d/1AbC-dEf_9/preview";
    expect(embedUrl("https://drive.google.com/file/d/1AbC-dEf_9/view?usp=sharing")).toBe(want);
    expect(embedUrl("https://drive.google.com/open?id=1AbC-dEf_9")).toBe(want);
    expect(embedUrl("https://drive.google.com/uc?export=download&id=1AbC-dEf_9")).toBe(want);
  });

  it("embedUrl: YouTube and rejects everything else", () => {
    expect(embedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(embedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(embedUrl("http://drive.google.com/file/d/abc/view")).toBeNull();
    expect(embedUrl("https://example.com/video.mp4")).toBeNull();
    expect(embedUrl("")).toBeNull();
  });

  it("parseLibraryList reads name | link lines and flags bad ones", () => {
    const r = parseLibraryList(
      "Marklyft | https://drive.google.com/file/d/AAA/view\n\nFront squat;https://youtu.be/dQw4w9WgXcQ\nBara ett namn\nKnäböj | https://example.com/x",
    );
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ name: "Marklyft", error: "" });
    expect(r[1]).toMatchObject({ name: "Front squat", error: "" });
    expect(r[2].error).toBe("No link found");
    expect(r[3].error).toBe("Not a Drive or YouTube link");
  });

  it("videoLookup finds by name regardless of case", () => {
    const f = videoLookup([{ name: "Marklyft", videoUrl: "u1" }]);
    expect(f(" marklyft ")).toBe("u1");
    expect(f("Squat")).toBeNull();
  });
});
