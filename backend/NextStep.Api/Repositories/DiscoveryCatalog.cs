using System.Text.Json;

namespace NextStep.Api;

// Discovery projections extend scope without pretending courses are hackathons.
// Canonical Opportunity remains the authority for reviewed hackathon rules/plans.
public sealed record ListingSummary(string Id, string Kind, string Title, string Organizer, string Format, string OfficialUrl, string Summary, string[] Topics, string Scope, string? RegistrationDeadline, string RegistrationState, string CostStatus, string? LastReviewedAt, string SourceStatus, string? SourcePassage, string VerificationNote)
{
    public string? FirstSeenAt { get; init; }
    public string? LastCheckedAt { get; init; }
    public string? SourcePageUrl { get; init; }
    public string? EventEndAt { get; init; }
    public string AvailabilityState { get; init; } = "unknown";
    public string SourceFreshness { get; init; } = "not_checked";
    public string? UniversityId { get; init; }
    public string? OrganizationId { get; init; }
    public string ExtractionMethod { get; init; } = "source_record";
}
public sealed record SourceRegistration(string Id, string Name, string Url, string Region, string Channel, string Collection, string? VerificationUrl, string Note) {
    public string? UniversityId { get; init; }
    public string? OrganizationId { get; init; }
}
public sealed class DiscoveryCatalog(Catalog catalog, PalestineNetwork? network = null)
{
    public SourceRegistration[] Sources() => Read<SourceRegistration[]>("sources.json").Concat((network ?? new PalestineNetwork()).Sources()).DistinctBy(s => s.Id).ToArray();
    // A detailed planning record can share an existing discovery ID; keep its richer listing projection once.
    public ListingSummary[] Listings() => Read<ListingSummary[]>("listings.json").Concat(catalog.All().Select(o => new ListingSummary(o.Id, "hackathon", o.Title, o.Organizer, o.Format, o.OfficialUrl, o.Theme, o.InterestTags.Select(tag => tag.Label).ToArray(), "global_online", Catalog.Instant(o, "registration_close")?.ToString("O"), Catalog.Instant(o, "registration_close") is { } cutoff && cutoff < DateTimeOffset.UtcNow ? "closed" : "not_specified", o.CostStatus, o.LastReviewedAt, "needs_verification", null, "Source-backed planning snapshot; inspect coverage and original passages before participating. Registration and submission deadlines are separate."))).GroupBy(item => item.Id, StringComparer.Ordinal).Select(group => group.First()).Select(WithTimeSemantics).ToArray();
    public static ListingSummary WithTimeSemantics(ListingSummary listing) => listing with {
        RegistrationDeadline = ContractTime.IsInstant(listing.RegistrationDeadline) ? listing.RegistrationDeadline : null,
        LastReviewedAt = ContractTime.IsInstant(listing.LastReviewedAt) ? listing.LastReviewedAt : null,
        SourceStatus = listing.SourceStatus == "reviewed" && !ContractTime.IsInstant(listing.LastReviewedAt) ? "needs_verification" : listing.SourceStatus,
        VerificationNote = listing.VerificationNote + (listing.RegistrationDeadline is not null && !ContractTime.IsInstant(listing.RegistrationDeadline) ? " Published date text (unconfirmed instant): " + listing.RegistrationDeadline : "")
    };
    private static T Read<T>(string file) => JsonSerializer.Deserialize<T>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Data", file)), Wire.Json)!;
}
