using System.ComponentModel;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;

namespace NextStep.MetaAi.Evaluation;

// Reporting only: never serialize MetaAiOptions, environment variables or Git diagnostics.
internal sealed record EvaluationConfiguration(string Model, int AttemptTimeoutSeconds,
    int OverallTimeoutSeconds, int MaxRetries, int MaxRetryDelaySeconds, int MaxResponseBytes);

internal sealed record EvaluationProvenance(DateTimeOffset ExecutedAtUtc, string? GitCommitSha,
    bool? RelevantSourceHasUncommittedChanges, bool? SourceMatchesWorkingTree,
    string SourceFingerprint, string PromptFingerprint, string ScenarioVersion,
    string ScenarioFingerprint, EvaluationConfiguration Configuration)
{
    internal const string ScenarioSetVersion = "synthetic-v1";
    private const string ResourcePrefix = "evaluation-source/";
    private const string PromptPath = "ai/dotnet/NextStep.MetaAi/MetaModelClient.cs";
    private const string ScenarioPath = "ai/dotnet/NextStep.MetaAi.Eval/Program.cs";

    internal static EvaluationProvenance Capture(DateTimeOffset executedAt, MetaAiOptions options,
        IReadOnlyDictionary<string, byte[]> sources, string? repositoryRoot)
    {
        string? commit = null;
        bool? dirty = null;
        bool? matches = null;
        if (repositoryRoot is not null)
        {
            var head = TryGit(repositoryRoot, ["rev-parse", "HEAD"])?.Trim();
            if (head is { Length: 40 or 64 } && head.All(Uri.IsHexDigit)) commit = head;
            var status = TryGit(repositoryRoot,
                ["status", "--porcelain=v1", "--untracked-files=all", "--", .. sources.Keys.Order(StringComparer.Ordinal)]);
            if (status is not null) dirty = status.Length != 0;
            try
            {
                // Read only embedded source paths. Never discover or read runtime configuration.
                matches = sources.All(s => File.Exists(Path.Combine(repositoryRoot, s.Key)) &&
                    s.Value.AsSpan().SequenceEqual(File.ReadAllBytes(Path.Combine(repositoryRoot, s.Key))));
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
        var scenarioSources = new Dictionary<string, byte[]> { [ScenarioPath] = sources[ScenarioPath] };
        const string fixturePath = "ai/dotnet/NextStep.MetaAi.Eval/Fixtures/structured-scenarios.json";
        if (sources.TryGetValue(fixturePath, out var fixture)) scenarioSources[fixturePath] = fixture;
        return new(executedAt.ToUniversalTime(), commit, dirty, matches, Fingerprint(sources),
            Fingerprint(new Dictionary<string, byte[]> { [PromptPath] = sources[PromptPath] }),
            ScenarioSetVersion, Fingerprint(scenarioSources),
            new(options.Model, options.AttemptTimeoutSeconds, options.OverallTimeoutSeconds,
                options.MaxRetries, options.MaxRetryDelaySeconds, options.MaxResponseBytes));
    }

    internal static IReadOnlyDictionary<string, byte[]> ReadEmbeddedSources()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var sources = new SortedDictionary<string, byte[]>(StringComparer.Ordinal);
        foreach (var name in assembly.GetManifestResourceNames().Where(n => n.StartsWith(ResourcePrefix, StringComparison.Ordinal)))
        {
            var path = "ai/dotnet/" + name[ResourcePrefix.Length..].Replace('\\', '/');
            using var stream = assembly.GetManifestResourceStream(name)!;
            using var buffer = new MemoryStream();
            stream.CopyTo(buffer);
            sources.Add(path, buffer.ToArray());
        }
        return sources;
    }

    internal static string Fingerprint(IReadOnlyDictionary<string, byte[]> sources)
    {
        // Sorted paths plus per-file SHA-256 and delimiters avoid ordering/concatenation ambiguity.
        var manifest = string.Concat(sources.OrderBy(s => s.Key, StringComparer.Ordinal)
            .Select(s => s.Key + "\0" + Convert.ToHexString(SHA256.HashData(s.Value)) + "\n"));
        return "sha256:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(manifest))).ToLowerInvariant();
    }

    internal static string? FindRepositoryRoot()
    {
        foreach (var start in new[] { Environment.CurrentDirectory, AppContext.BaseDirectory })
            for (var directory = new DirectoryInfo(start); directory is not null; directory = directory.Parent)
                if ((Directory.Exists(Path.Combine(directory.FullName, ".git")) || File.Exists(Path.Combine(directory.FullName, ".git"))) &&
                    File.Exists(Path.Combine(directory.FullName, "ai/dotnet/NextStep.MetaAi.Eval/NextStep.MetaAi.Eval.csproj")))
                    return directory.FullName;
        return null;
    }

    private static string? TryGit(string root, string[] arguments)
    {
        try
        {
            var start = new ProcessStartInfo("git") { WorkingDirectory = root,
                RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false,
                CreateNoWindow = true };
            start.Environment["GIT_OPTIONAL_LOCKS"] = "0";
            foreach (var argument in arguments) start.ArgumentList.Add(argument);
            using var process = Process.Start(start)!;
            var output = process.StandardOutput.ReadToEndAsync();
            var error = process.StandardError.ReadToEndAsync();
            if (!process.WaitForExit(3000)) { process.Kill(entireProcessTree: true); return null; }
            Task.WhenAll(output, error).GetAwaiter().GetResult();
            return process.ExitCode == 0 ? output.Result : null;
        }
        catch (Win32Exception) { return null; }
        catch (InvalidOperationException) { return null; }
        catch (IOException) { return null; }
        catch (UnauthorizedAccessException) { return null; }
    }
}
