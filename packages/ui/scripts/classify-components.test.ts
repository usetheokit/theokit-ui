/**
 * Tests for the component classification gate (plan
 * `wiki/quality-gates/gate-catalog.md`).
 *
 * `checkClassification` is a pure function (manifest + on-disk dirs -> drift result)
 * so the drift/consistency logic is tested in isolation. `loadAndCheck` is the thin
 * I/O wrapper; its input-guard cases (absent file, malformed JSON) are tested against
 * a temp directory.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type ClassificationEntry,
  checkClassification,
  listTopLevelDirs,
  loadAndCheck,
  report,
} from "./classify-components.js";

const validEntry = {
  name: "button",
  layer: "primitive" as const,
  tier: "generic" as const,
  target: "@usetheo/ui" as const,
  rationale: "shadcn-like primitive",
};

const onDisk = { primitive: ["button", "agent-event"], composite: ["chat-message"] };

describe("checkClassification (pure drift + consistency)", () => {
  const fullManifest = [
    validEntry,
    {
      name: "agent-event",
      layer: "primitive",
      tier: "ai",
      target: "@theokit/ui",
      rationale: "agent surface",
    },
    {
      name: "chat-message",
      layer: "composite",
      tier: "ai",
      target: "@theokit/ui",
      rationale: "chat surface",
    },
  ];

  it("passes_when_every_dir_classified_and_consistent", () => {
    const r = checkClassification(fullManifest, onDisk);
    expect(r.ok).toBe(true);
    expect(r.classifiedCount).toBe(3);
    expect(r.offenders).toEqual([]);
  });

  it("fails_when_ondisk_dir_missing_from_manifest", () => {
    const r = checkClassification([validEntry], {
      primitive: ["button", "tool-call"],
      composite: [],
    });
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("tool-call"))).toBe(true);
  });

  it("fails_when_manifest_entry_references_nonexistent_dir", () => {
    const r = checkClassification(
      [
        validEntry,
        {
          name: "ghost",
          layer: "primitive",
          tier: "generic",
          target: "@usetheo/ui",
          rationale: "x",
        },
      ],
      { primitive: ["button"], composite: [] },
    );
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("ghost"))).toBe(true);
  });

  it("fails_when_tier_invalid", () => {
    const r = checkClassification([{ ...validEntry, tier: "foo" }], {
      primitive: ["button"],
      composite: [],
    });
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("tier"))).toBe(true);
  });

  it("fails_when_target_inconsistent_with_tier", () => {
    const r = checkClassification([{ ...validEntry, tier: "ai", target: "@usetheo/ui" }], {
      primitive: ["button"],
      composite: [],
    });
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("target"))).toBe(true);
  });

  it("fails_when_duplicate_entry", () => {
    const r = checkClassification(
      [validEntry, { ...validEntry, tier: "ai", target: "@theokit/ui" }],
      { primitive: ["button"], composite: [] },
    );
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("duplicate"))).toBe(true);
  });

  it("fails_when_declared_layer_mismatches_location", () => {
    const r = checkClassification([{ ...validEntry, layer: "composite" }], {
      primitive: ["button"],
      composite: [],
    });
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("layer"))).toBe(true);
  });

  it("fails_clear_when_manifest_not_array", () => {
    const r = checkClassification({ button: validEntry }, onDisk);
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("array"))).toBe(true);
  });

  it("fails_when_manifest_empty", () => {
    // Plan T1.1 Deep Dives edge case: empty manifest -> every dir unclassified.
    const r = checkClassification([], { primitive: ["button"], composite: ["chat-message"] });
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("button"))).toBe(true);
    expect(r.offenders.some((o) => o.includes("chat-message"))).toBe(true);
  });

  it("fails_when_layer_keyed_homonym_unclassified", () => {
    // F-arch-1: identity is (layer, name). A composite entry named "x" must NOT
    // satisfy an on-disk primitive dir "x" — name-only keying would miss this.
    const r = checkClassification(
      [{ name: "x", layer: "composite", tier: "generic", target: "@usetheo/ui", rationale: "y" }],
      { primitive: ["x"], composite: [] },
    );
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("primitive/x"))).toBe(true);
  });
});

describe("loadAndCheck (I/O input guards)", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "classify-"));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails_clear_when_manifest_absent", async () => {
    const r = await loadAndCheck(join(dir, "does-not-exist.json"));
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("not found"))).toBe(true);
  });

  it("fails_clear_when_malformed_json", async () => {
    const p = join(dir, "bad.json");
    writeFileSync(p, "{ not valid json ");
    const r = await loadAndCheck(p);
    expect(r.ok).toBe(false);
    expect(r.offenders.some((o) => o.includes("malformed"))).toBe(true);
  });

  it("lists_only_top_level_dirs_not_nested", async () => {
    // EC-5: nested dirs (e.g. slide/plugins) must not become phantom components.
    mkdirSync(join(dir, "foo", "nested"), { recursive: true });
    mkdirSync(join(dir, "bar"));
    const dirs = await listTopLevelDirs(dir);
    expect(dirs.sort()).toEqual(["bar", "foo"]);
  });

  it("passes_against_the_real_authored_manifest", async () => {
    const r = await loadAndCheck();
    expect(r.ok).toBe(true);
    expect(r.classifiedCount).toBe(87);
  });
});

describe("report (exit code + message)", () => {
  it("returns code 0 and a drift-free message on ok", () => {
    const { code, message } = report({ ok: true, classifiedCount: 136, offenders: [] });
    expect(code).toBe(0);
    expect(message).toContain("136 components, 0 drift");
  });

  it("returns code 1 and lists offenders on failure", () => {
    const { code, message } = report({
      ok: false,
      classifiedCount: 0,
      offenders: ["unclassified: tool-call"],
    });
    expect(code).toBe(1);
    expect(message).toContain("FAILED");
    expect(message).toContain("tool-call");
  });
});

describe("component-classification.json (authored manifest — T1.2)", () => {
  const manifestPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "registry",
    "component-classification.json",
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ClassificationEntry[];
  const byName = new Map(manifest.map((e) => [e.name, e]));

  it("manifest_has_87_entries_all_ai", () => {
    // Post-M-C: theo-ui is AI-exclusive — the 54 non-AI moved to @usetheo/ui.
    // M2 (2026-07-16): +4 code-agent Builder-parity primitives (82 → 86); +1 composite `markdown` (86 → 87).
    expect(manifest.length).toBe(87);
    for (const e of manifest) {
      expect(e.tier).toBe("ai");
      expect(e.target).toBe("@theokit/ui");
    }
  });

  // Post-M-C, the non-AI components moved to @usetheo/ui; the boundary components that
  // STAY in theo-ui are all ai. Assert the ones that were near the boundary remain ai.
  it("boundary_components_that_stay_are_ai", () => {
    for (const name of ["terminal-panel", "build-log-stream", "cron-job-card", "cron-jobs-list"]) {
      expect(byName.get(name)?.target, `${name} should stay in @theokit/ui`).toBe("@theokit/ui");
    }
    // moved components must be ABSENT from theo-ui's manifest
    for (const name of ["button", "env-var-editor", "deployment-row", "metrics-panel"]) {
      expect(byName.get(name), `${name} should have moved to @usetheo/ui`).toBeUndefined();
    }
  });

  it("disputed_set_is_the_genuinely_dual_components", () => {
    // disputed = the components that are genuinely dual (ai-but-arguably-ops), carried
    // forward to M-C for re-examination. Evidence-clear ones are NOT disputed.
    const disputed = manifest
      .filter((e) => e.disputed)
      .map((e) => e.name)
      .sort();
    expect(disputed).toEqual(["channel-card", "cron-job-card", "cron-jobs-list"]);
    for (const n of ["build-log-stream", "env-var-editor", "metrics-panel"]) {
      expect(byName.get(n)?.disputed).toBeUndefined();
    }
  });
});
