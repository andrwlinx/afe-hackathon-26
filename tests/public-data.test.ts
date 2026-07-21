import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GraphDatasetSchema } from "../src/shared/graph.js";

const internalPatterns = [
  /amazon\.com/i,
  /a2z\.com/i,
  /aws\.dev/i,
  /amzn1\./i,
  /arn:aws:/i,
  /@amazon\./i
];

describe("public fixture safety", () => {
  it("is schema-valid and contains no obvious internal identifiers", async () => {
    const raw = await readFile(
      path.resolve(process.cwd(), "data/public/graph.json"),
      "utf8"
    );

    expect(() => GraphDatasetSchema.parse(JSON.parse(raw))).not.toThrow();
    for (const pattern of internalPatterns) {
      expect(raw).not.toMatch(pattern);
    }
  });

  it("keeps private snapshots ignored", async () => {
    const ignore = await readFile(path.resolve(process.cwd(), ".gitignore"), "utf8");
    expect(ignore).toContain("data/private/");
  });
});
