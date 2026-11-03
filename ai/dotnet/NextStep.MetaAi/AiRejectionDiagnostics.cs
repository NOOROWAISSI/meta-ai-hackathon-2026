using System.Collections.Concurrent;
using System.Text.Json;

namespace NextStep.MetaAi;

/// <summary>
/// Opt-in, content-free diagnostics for structured-output rejections.
/// Records only the validation stage, a typed reason category and the model
/// identifier. It never records provider payloads, profile content, prompts,
/// credentials or headers. Disabled by default; the model client enables it
/// only when MetaAiOptions.DiagnosticsEnabled is set, which production
/// configuration does not do. The optional file sink is a local operator
/// choice for controlled diagnosis on synthetic data.
/// </summary>
public static class AiRejectionDiagnostics
{
    private static readonly ConcurrentQueue<string> RecentCategories = new();
    private static readonly AsyncLocal<string?> LastCategory = new();

    public static bool Enabled { get; set; }
    public static string? FilePath { get; set; }

    public static void Record(string stage, string category, string? model)
    {
        LastCategory.Value = category;
        if (!Enabled) return;
        RecentCategories.Enqueue(category);
        if (FilePath is { } path)
        {
            try
            {
                var line = JsonSerializer.Serialize(new { ts = DateTimeOffset.UtcNow, stage, category, model });
                File.AppendAllText(path, line + "\n");
            }
            catch { /* Diagnostics must never break generation. */ }
        }
    }

    /// <summary>The most recent category recorded on this async flow, if any.</summary>
    public static string? TakeLastCategory()
    {
        var value = LastCategory.Value;
        LastCategory.Value = null;
        return value;
    }

    public static IReadOnlyList<string> Snapshot() => RecentCategories.ToArray();

    public static void Clear()
    {
        while (RecentCategories.TryDequeue(out _)) { }
        LastCategory.Value = null;
    }
}
