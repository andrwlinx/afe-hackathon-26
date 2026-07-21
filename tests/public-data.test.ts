import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GraphDatasetSchema } from "../src/shared/graph.js";
import {
  ExpertisePeopleFileSchema,
  ExpertiseRelationshipsFileSchema,
  ExpertiseResourcesFileSchema
} from "../src/shared/expertise.js";

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
    const publicDirectory = path.resolve(process.cwd(), "data/public");
    const files = (await readdir(publicDirectory, { recursive: true })).filter(
      (file) => file.endsWith(".json")
    );
    const contents = await Promise.all(
      files.map((file) => readFile(path.join(publicDirectory, file), "utf8"))
    );
    const graphRaw = await readFile(
      path.join(publicDirectory, "graph.json"),
      "utf8"
    );

    expect(() => GraphDatasetSchema.parse(JSON.parse(graphRaw))).not.toThrow();
    expect(() =>
      ExpertisePeopleFileSchema.parse(
        JSON.parse(
          contents[files.indexOf("expertise/people.example.json")]
        )
      )
    ).not.toThrow();
    expect(() =>
      ExpertiseResourcesFileSchema.parse(
        JSON.parse(
          contents[files.indexOf("expertise/resources.example.json")]
        )
      )
    ).not.toThrow();
    expect(() =>
      ExpertiseRelationshipsFileSchema.parse(
        JSON.parse(
          contents[files.indexOf("expertise/relationships.example.json")]
        )
      )
    ).not.toThrow();
    for (const pattern of internalPatterns) {
      for (const raw of contents) {
        expect(raw).not.toMatch(pattern);
      }
    }
  });

  it("keeps private snapshots ignored", async () => {
    const ignore = await readFile(path.resolve(process.cwd(), ".gitignore"), "utf8");
    expect(ignore).toContain("data/private/");
  });
});
