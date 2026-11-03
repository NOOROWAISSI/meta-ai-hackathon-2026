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
///
/// Process-wide state, by design for a local diagnostic: Enabled and FilePath
/// are static and are applied by the MetaModelClient constructor (enable
/// only; a client built without diagnostics never turns them off, and the
/// last enabled client wins the file path). The in-memory queue is bounded.
/// Internal proof verification (PlanActionRenderer.Matches and
/// MatchesForDisplay) runs suppressed, so categories represent provider
/// output rejections on the generation path, not internal re-checks.
/// </summary>
public static class AiRejectionDiagnostics
{
    private const int MaxRecentCategories = 256;
    private static readonly ConcurrentQueue<string> RecentCategories = new();
    private static readonly AsyncLocal<string?> LastCategory = new();
    private static readonly AsyncLocal<int> SuppressionDepth = new();
    private static readonly object FileLock = new();

    public static bool Enabled { get; set; }
    public static string? FilePath { get; set; }

    /// <summary>Suppresses recording on this async flow until disposed.</summary>
    public static IDisposable Suppress()
    {
        SuppressionDepth.Value++;
        return new SuppressionScope();
    }

    private sealed class SuppressionScope : IDisposable
    {
        private bool _disposed;
        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            SuppressionDepth.Value--;
        }
    }

    public static void Record(string stage, string category, string? model)
    {
        if (SuppressionDepth.Value > 0) return;
        LastCategory.Value = category;
        if (!Enabled) return;
        RecentCategories.Enqueue(category);
        while (RecentCategories.Count > MaxRecentCategories && RecentCategories.TryDequeue(out _)) { }
        if (FilePath is { } path)
        {
            try
            {
                var line = JsonSerializer.Serialize(new { ts = DateTimeOffset.UtcNow, stage, category, model });
                lock (FileLock) { File.AppendAllText(path, line + "\n"); }
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
