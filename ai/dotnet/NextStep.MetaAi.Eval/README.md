# NextStep Meta AI Quality Evaluation

A small .NET 8 console harness for exploratory evaluation of `NextStep.MetaAi` with six synthetic student scenarios. Structural success is not a quality score or evidence of end-to-end integration.

- No arguments or `--list`: print scenarios with **zero provider calls**. `--list` takes precedence even if `--live` is also supplied; credentials are not read.
- `--live`: explicitly opt into six potentially billable provider requests via the existing client, including its configured retries. Requires `MODEL_API_KEY` in the environment. Use synthetic inputs only.
- Results go to a new system temporary directory (`nextstep-meta-eval-<UTC timestamp>-<random suffix>`). Paths are printed; create-new writes protect earlier reports.
- Outputs retain structural status, latency, tasks, candidate details, feasibility diagnostics, review flags and the manual rubric. `ok` means the API response passed structural validation. Complete the manual verdict in `REVIEW.md`; no quality verdict is generated automatically.

## Offline commands

From the repository root, with .NET 8 available:

```sh
dotnet build ai/dotnet/NextStep.MetaAi.Eval/NextStep.MetaAi.Eval.csproj
dotnet run --no-build --project ai/dotnet/NextStep.MetaAi.Eval -- --list
dotnet build ai/dotnet/NextStep.MetaAi.Checks/NextStep.MetaAi.Checks.csproj
dotnet run --no-build --project ai/dotnet/NextStep.MetaAi.Checks
```

The offline checks exercise report serialization, metadata/configuration, credential exclusion and fingerprints without provider calls. This cleanup made no live requests. For a separately authorized live run, supply the key securely through the process environment and pass `--live`; never place credentials in command arguments, reports or committed files.

## Report schema and provenance

`results.json` now uses schema version 2:

```json
{
  "schemaVersion": 2,
  "provenance": {
    "executedAtUtc": "2026-10-28T00:00:00+00:00",
    "gitCommitSha": null,
    "relevantSourceHasUncommittedChanges": null,
    "sourceMatchesWorkingTree": null,
    "sourceFingerprint": "sha256:<embedded source digest>",
    "promptFingerprint": "sha256:<client source digest>",
    "scenarioVersion": "synthetic-v1",
    "scenarioFingerprint": "sha256:<runner source digest>",
    "configuration": {
      "model": "muse-spark-1.3",
      "attemptTimeoutSeconds": 30,
      "overallTimeoutSeconds": 60,
      "maxRetries": 1,
      "maxRetryDelaySeconds": 5,
      "maxResponseBytes": 131072
    }
  },
  "results": []
}
```

The example has no scenario executions. Real runs preserve the existing per-scenario records under `results`; consumers of the old top-level array should read `document.results` for schema 2 (or `document.results ?? document` to support both formats). Historical reports are not rewritten. `REVIEW.md` includes the same provenance JSON alongside the original results/rubric.

Fingerprints use SHA-256 over an ordinally sorted manifest of relative source paths and per-file SHA-256 digests. The evaluation assembly embeds only `.cs` and `.csproj` files from `NextStep.MetaAi` and `NextStep.MetaAi.Eval`, excluding `bin/` and `obj/`. This identifies build inputs including relevant uncommitted source changes. It reads/hashes no `.env`, runtime config, reports, credentials or unrelated user files. No new dependencies are required.

`promptFingerprint` conservatively fingerprints the full embedded `MetaModelClient.cs` (instructions, schema, context serialization and transport), without changing or extracting prompt behavior. `scenarioVersion` remains `synthetic-v1`; the runner-source fingerprint also detects scenario/flag/report-orchestration edits without relying on a manual version bump. The UTC execution start is the anchor used to create relative scenario deadlines; results still include measured latency and the existing budget diagnostics.

Git SHA and dirty state describe the working tree **at execution**, restricted to the embedded source paths. Untracked evaluation source counts as uncommitted. Missing Git, an inaccessible/non-repository checkout or missing metadata yields null fields without preventing reports. `sourceMatchesWorkingTree` compares only those source paths to their embedded bytes, exposing edits since build. For an exported binary without source, fingerprints remain available; Git metadata may be null. Rebuild before evaluating and check this field before attributing results to the observed commit. This is source provenance, not a complete SDK/dependency/environment attestation.

The safe configuration record includes the actual model and numeric timeout/retry/size values used by this harness. It never serializes `MetaAiOptions`, API keys, environment contents, endpoint query strings, raw Git errors or exception text. The harness uses default options plus the environment key, not host configuration.

## Rubric and limitations

Rate factual grounding, personalization, actionability, effort realism, and mandatory/retained work safety from 0 to 2. A material hallucination or omission blocks acceptance regardless of average. Inspect full deliverables, completion criteria and resource selections in JSON; a ready file is not proof of final submission.

The retained-work scenario carries titles/status but no remaining effort, so reported feasibility excludes retained hours. It is diagnostic only. A single run is exploratory, and automatic flags do not establish semantic correctness. No accepted plan/progress is stored or changed. Do not claim reliability, production readiness or a completed integration from this harness.
