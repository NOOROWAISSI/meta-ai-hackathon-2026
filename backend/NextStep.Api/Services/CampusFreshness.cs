using System.Globalization;
using System.Text.RegularExpressions;

namespace NextStep.Api;

public static class CampusFreshness {
    public static string Classify(CampusActivity post, DateTimeOffset now) {
        if (post.Availability == "ended" || post.PostType == "recap" || post.RegistrationState == "closed") return "archived";
        if (post.RegistrationState == "open" && ContractTime.IsInstant(post.AvailabilityCheckedAt) && now >= DateTimeOffset.Parse(post.AvailabilityCheckedAt!) && now - DateTimeOffset.Parse(post.AvailabilityCheckedAt!) <= TimeSpan.FromDays(7)) return "current";
        // Source dates, not collection/publication timestamps, establish an upcoming activity.
        var text = post.EventDateText ?? "";
        var date = Regex.Match(text, @"^(\d{4}-\d{2}-\d{2}|\d{1,2} [A-Za-z]+ \d{4})(?:\b|T)", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
        if (date.Success && DateOnly.TryParseExact(date.Groups[1].Value, ["yyyy-MM-dd", "d MMMM yyyy", "dd MMMM yyyy"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var day) && day >= DateOnly.FromDateTime(now.UtcDateTime)) return "current";
        return "needs_recheck";
    }
}
