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
}
public sealed record SourceRegistration(string Id, string Name, string Url, string Region, string Channel, string Collection, string? VerificationUrl, string Note);
public sealed class DiscoveryCatalog(Catalog catalog)
{
    public SourceRegistration[] Sources() => Read<SourceRegistration[]>("sources.json");
    public ListingSummary[] Listings() => Read<ListingSummary[]>("listings.json").Concat(catalog.All().Select(o => new ListingSummary(o.Id, "hackathon", o.Title, o.Organizer, o.Format, o.OfficialUrl, o.Theme, [], "global_online", null, "not_specified", o.CostStatus, o.LastReviewedAt, "needs_verification", null, "Document-derived source snapshot; material-rule coverage is incomplete. Registration and submission deadlines are separate."))).Select(WithTimeSemantics).ToArray();
    public static ListingSummary WithTimeSemantics(ListingSummary listing) => listing with {
        RegistrationDeadline = ContractTime.IsInstant(listing.RegistrationDeadline) ? listing.RegistrationDeadline : null,
        LastReviewedAt = ContractTime.IsInstant(listing.LastReviewedAt) ? listing.LastReviewedAt : null,
        SourceStatus = listing.SourceStatus == "reviewed" && !ContractTime.IsInstant(listing.LastReviewedAt) ? "needs_verification" : listing.SourceStatus,
        VerificationNote = listing.VerificationNote + (listing.RegistrationDeadline is not null && !ContractTime.IsInstant(listing.RegistrationDeadline) ? " Published date text (unconfirmed instant): " + listing.RegistrationDeadline : "")
    };
    private static T Read<T>(string file) => JsonSerializer.Deserialize<T>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Data", file)), Wire.Json)!;
}
