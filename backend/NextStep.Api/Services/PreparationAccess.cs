namespace NextStep.Api;

// Public navigation capability, not an eligibility verdict or a replacement for the v0.2 planning DTOs.
public sealed record PreparationAccess(string OpportunityId, string Title, string Organizer, string Kind, string OfficialUrl, string State, string? PlanningOpportunityId, string[] ReviewNeeds)
{
    public static PreparationAccess For(ListingSummary listing, Opportunity? planningRecord)
    {
        var supported = listing.Kind == "hackathon";
        var hasRecord = supported && planningRecord is not null && planningRecord.Id == listing.Id;
        return new(listing.Id, listing.Title, listing.Organizer, listing.Kind, listing.OfficialUrl,
            !supported ? "unsupported_kind" : hasRecord ? "workspace_available" : "source_review_required",
            hasRecord ? planningRecord!.Id : null,
            supported && !hasRecord ? ["participation_rules", "submission_requirements", "source_evidence"] : []);
    }
}
