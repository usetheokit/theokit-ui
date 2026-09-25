#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REGISTRY_DIR = join(ROOT, "registry");
const OUT_DIR = join(REGISTRY_DIR, "r");
const SRC_DIR = join(ROOT, "src");

const writeStdout = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

type RegistryType =
  | "registry:component"
  | "registry:lib"
  | "registry:hook"
  | "registry:ui"
  | "registry:block";

interface RegistryFile {
  path: string;
  type: RegistryType;
  target?: string;
  content?: string;
}

interface RegistryDescriptor {
  $schema?: string;
  name: string;
  type: RegistryType;
  title?: string;
  description?: string;
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
  cssVars?: Record<string, Record<string, string>>;
}

interface Failure {
  file: string;
  message: string;
}

const failures: Failure[] = [];

const addFailure = (file: string, message: string): void => {
  failures.push({ file, message });
};

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, "utf-8")) as T;

const stripExtension = (value: string): string => value.replace(/\.(tsx|ts|jsx|js|css)$/, "");

const importSpecifiers = (content: string): string[] => {
  // Strip block + line comments before scanning for imports. Without this,
  // CSS `/* ... @import "@theokit/ui/fonts-cdn.css" ... */` narrative
  // comments are falsely treated as runtime imports.
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const specs: string[] = [];
  const patterns = [/from\s+["']([^"']+)["']/g, /import\s+["']([^"']+)["']/g];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    match = pattern.exec(stripped);
    while (match !== null) {
      if (match[1]) specs.push(match[1]);
      match = pattern.exec(stripped);
    }
  }

  return specs;
};

const registryNameFromTarget = (specifier: string): string | undefined => {
  if (specifier.startsWith("@/components/ui/")) return specifier.replace("@/components/ui/", "");
  if (specifier.startsWith("@/components/blocks/"))
    return specifier.replace("@/components/blocks/", "");
  if (specifier === "@/lib/cn") return "cn";
  if (specifier === "@/lib/types") return "types";
  if (specifier === "@/types/chat") return "chat-types";
  if (specifier === "@/types/rule") return "rule-types";
  if (specifier === "@/types/mode") return "mode-types";
  if (specifier === "@/types/agent") return "agent-types";
  if (specifier === "@/types/permission") return "permission-types";
  if (specifier === "@/types/task") return "task-types";
  return undefined;
};

async function copyBuiltItemIntoFixture(
  item: RegistryDescriptor,
  fixtureRoot: string,
): Promise<void> {
  for (const file of item.files) {
    if (!file.target || !file.content) continue;
    const targetPath = join(fixtureRoot, file.target);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.content);
  }
}

async function main(): Promise<void> {
  const descriptorFiles = (await readdir(REGISTRY_DIR))
    .filter(
      (file) =>
        file.endsWith(".json") && file !== "index.json" && file !== "component-classification.json",
    )
    .sort();

  const descriptors = new Map<string, RegistryDescriptor>();
  for (const descriptorFile of descriptorFiles) {
    const descriptorPath = join(REGISTRY_DIR, descriptorFile);
    const descriptor = await readJson<RegistryDescriptor>(descriptorPath);
    descriptors.set(descriptor.name, descriptor);

    if (!descriptor.$schema?.includes("registry-item.json")) {
      addFailure(descriptorFile, "must declare the shadcn registry item schema");
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(descriptor.name)) {
      addFailure(descriptorFile, `invalid registry item name "${descriptor.name}"`);
    }
    if (!descriptor.title || !descriptor.description) {
      addFailure(descriptorFile, "must include title and description");
    }
    if (!Array.isArray(descriptor.files) || descriptor.files.length === 0) {
      addFailure(descriptorFile, "must include at least one file");
    }

    for (const file of descriptor.files ?? []) {
      const sourcePath = join(SRC_DIR, file.path);
      if (!existsSync(sourcePath)) {
        addFailure(descriptorFile, `references missing source file src/${file.path}`);
      }
      if (!file.target) {
        addFailure(descriptorFile, `file ${file.path} must declare target`);
      }
    }
  }

  const index = await readJson<{
    metadata?: { requires?: { tsconfigPathAlias?: Record<string, string[]> } };
    items: Array<{ name: string; type: RegistryType; title: string; description: string }>;
  }>(join(REGISTRY_DIR, "index.json"));
  const indexNames = new Set(index.items.map((item) => item.name));
  for (const name of descriptors.keys()) {
    if (!indexNames.has(name)) addFailure("index.json", `missing descriptor item "${name}"`);
  }
  for (const name of indexNames) {
    if (!descriptors.has(name)) addFailure("index.json", `references missing descriptor "${name}"`);
  }

  // T2.3: gate the `@/` alias precondition. Items inline source that imports
  // from `@/`; consumers must have that alias mapped in tsconfig. The index
  // must declare the requirement so downstream tooling can surface it.
  const declaredAlias = index.metadata?.requires?.tsconfigPathAlias?.["@/*"];
  if (!declaredAlias || declaredAlias.length === 0) {
    addFailure(
      "index.json",
      'metadata.requires.tsconfigPathAlias["@/*"] is required; consumers need the "@/" path alias mapped to ./src for shadcn-style copy-paste to resolve "@/lib/cn", "@/components/ui/...", etc.',
    );
  }

  const BUILTIN_RUNTIMES = new Set(["react", "react-dom", "react/jsx-runtime"]);

  // Build a reverse map: shipped file target → owning registry item name.
  // This lets us resolve imports like `@/components/ui/toaster` to the item
  // that ships that file (in this case, `toast.json`, whose files[] includes
  // a target `components/ui/toaster.tsx`). Without this, multi-file registry
  // items (toast ships toast + toaster) cause spurious "missing dependency"
  // failures on consumers that import the secondary file.
  const targetToItemName = new Map<string, string>();
  for (const [name, descriptor] of descriptors) {
    for (const file of descriptor.files ?? []) {
      if (!file.target) continue;
      const normalized = stripExtension(`@/${file.target}`);
      // Multiple items shouldn't ship the same target — but if they do, last
      // writer wins; the validate-registry "duplicate target" gate handles
      // surface-level uniqueness elsewhere.
      targetToItemName.set(normalized, name);
    }
  }

  // Which BUILT artifact ships which path. `targetToItemName` above answers the same shape of
  // question from the DESCRIPTORS and keyed by `@/target`; this one is keyed by the path a built
  // artifact actually carries, which is what a `./` import resolves to.
  const shippedBy = new Map<string, string>();
  for (const [name] of descriptors) {
    const builtFile = join(OUT_DIR, `${name}.json`);
    if (!existsSync(builtFile)) continue;
    const item = await readJson<RegistryDescriptor>(builtFile);
    for (const shipped of item.files ?? []) {
      shippedBy.set(stripExtension(shipped.path), name);
    }
  }

  // A registry dependency is spelled either as a bare item name or as a full URL to its JSON.
  const dependencyItemName = (dependency: string): string =>
    stripExtension(dependency.replace(/^.*\//, ""));

  function resolveDependencyName(specifier: string): string | undefined {
    const stripped = stripExtension(specifier);
    const direct = registryNameFromTarget(stripped);
    if (direct) {
      // Check whether `direct` is itself the name of a built registry item.
      // If not (e.g. `toaster`), try the reverse-target map.
      if (descriptors.has(direct)) return direct;
      const owner = targetToItemName.get(stripped);
      if (owner) return owner;
      return direct; // Fall back so the legacy failure message still fires.
    }
    return undefined;
  }

  for (const [name, descriptor] of descriptors) {
    const builtPath = join(OUT_DIR, `${name}.json`);
    if (!existsSync(builtPath)) {
      addFailure(`${name}.json`, `missing generated registry/r/${name}.json`);
      continue;
    }

    const built = await readJson<RegistryDescriptor>(builtPath);
    // Every path this artifact actually SHIPS, without its extension. A `./` import is checked
    // against this set below — see the comment at that check for why nothing did before.
    const shippedStems = new Set<string>();
    for (const shipped of built.files) {
      const stem = stripExtension(shipped.path);
      shippedStems.add(stem);
      // `./x` may legitimately mean `x/index`, so a shipped index registers both spellings.
      if (stem.endsWith("/index")) shippedStems.add(stem.slice(0, -"/index".length));
    }
    const dependencySet = new Set(descriptor.registryDependencies ?? []);
    const declaredPackages = new Set(descriptor.dependencies ?? []);
    const usedPackages = new Set<string>();

    for (const file of built.files) {
      if (!file.content) {
        addFailure(`registry/r/${name}.json`, `file ${file.path} is missing inlined content`);
        continue;
      }

      for (const specifier of importSpecifiers(file.content)) {
        if (specifier.startsWith("..")) {
          addFailure(
            `registry/r/${name}.json`,
            `contains consumer-unsafe relative import "${specifier}"`,
          );
          continue;
        }
        if (specifier.endsWith(".js")) {
          addFailure(
            `registry/r/${name}.json`,
            `contains source ESM extension import "${specifier}"`,
          );
        }

        // A same-directory import must resolve to a file THIS artifact ships.
        //
        // The two other relative shapes were already covered and this one was covered by nobody:
        // `..` is refused outright a few lines above, and `@/…` resolves through
        // `registryNameFromTarget`, which then demands the owning item be in
        // `registryDependencies`. `./density` matches neither — `registryNameFromTarget` returns
        // `undefined` for it, so `resolveDependencyName` returns `undefined`, so the dependency
        // check below is skipped and nothing else asked whether the file was there at all.
        //
        // Measured on this registry the day the check was written: 26 such imports across 2 of
        // 100 artifacts, every one of them a runtime import rather than `import type`. A consumer
        // running `shadcn add theme-provider` received `theme-provider.tsx` importing `./density`
        // and `themes/index.ts` re-exporting seventeen modules, none of which were in the payload.
        //
        // Scoped to `./` on purpose: a file in another artifact is imported as `@/…` here, so a
        // same-directory specifier naming something this artifact does not carry is either an
        // undeclared file or a genuine mistake, and both are worth failing on.
        if (specifier.startsWith("./")) {
          const target = posix.normalize(
            posix.join(posix.dirname(file.path), stripExtension(specifier)),
          );
          if (!shippedStems.has(target)) {
            // A declared registry dependency shipping it is the CORRECT answer, not a loophole:
            // the consumer installs that item too, so the file arrives. Accepting it here is what
            // stops this check from pushing an author toward declaring the file twice — which is
            // worse than the gap, because two artifacts then write the same path on install.
            const owner = shippedBy.get(target);
            const owned =
              owner !== undefined &&
              (owner === name ||
                [...dependencySet].some((dep) => dependencyItemName(dep) === owner));
            if (!owned) {
              addFailure(
                `registry/r/${name}.json`,
                `imports "${specifier}" from ${file.path}, which resolves to "${target}" — a path neither this artifact nor any declared registryDependency ships`,
              );
            }
          }
        }

        if (specifier.startsWith("@/") || specifier.startsWith(".") || specifier.startsWith("/")) {
          const dependencyName = resolveDependencyName(specifier);
          if (dependencyName && dependencyName !== name && !dependencySet.has(dependencyName)) {
            addFailure(
              `${name}.json`,
              `imports ${specifier} but registryDependencies is missing "${dependencyName}"`,
            );
          }
          continue;
        }

        // External package import — extract package name (handle @scope/pkg/subpath).
        const pkg = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0];
        if (!pkg || BUILTIN_RUNTIMES.has(pkg)) continue;
        usedPackages.add(pkg);
      }
    }

    for (const pkg of usedPackages) {
      if (!declaredPackages.has(pkg)) {
        addFailure(`${name}.json`, `imports "${pkg}" but dependencies array is missing it`);
      }
    }
  }

  const fixtureRoot = await mkdtemp(join(tmpdir(), "theo-registry-"));
  try {
    for (const descriptor of descriptors.values()) {
      const built = await readJson<RegistryDescriptor>(join(OUT_DIR, `${descriptor.name}.json`));
      await copyBuiltItemIntoFixture(built, fixtureRoot);
    }

    for (const descriptor of descriptors.values()) {
      for (const dependency of descriptor.registryDependencies ?? []) {
        if (!descriptors.has(dependency) && !dependency.startsWith("http")) {
          addFailure(`${descriptor.name}.json`, `unknown registryDependency "${dependency}"`);
        }
      }
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error("Registry validation failed:");
    for (const failure of failures) {
      console.error(`- ${failure.file}: ${failure.message}`);
    }
    process.exit(1);
  }

  writeStdout(`Registry validation passed for ${descriptors.size} item(s).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
