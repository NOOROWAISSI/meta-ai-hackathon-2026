using System.Globalization;
using System.Text.RegularExpressions;

namespace NextStep.Api;

/// <summary>Explicit instants only. No server-local timezone or missing midnight is inferred.</summary>
public static class ContractTime
{
    private static readonly Regex InstantShape = new(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})\z", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
    public static bool TryInstant(string? value, out DateTimeOffset instant)
    {
        instant = default;
        return value is { Length: <= 40 } && !value.EndsWith("-00:00", StringComparison.Ordinal) && InstantShape.IsMatch(value) && DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out instant);
    }
    public static bool IsInstant(string? value) => TryInstant(value, out _);
    public static bool IsDate(string? value) => value is { Length: 10 } && DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
}
