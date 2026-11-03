using Microsoft.AspNetCore.Mvc;

namespace NextStep.Api.Controllers;

public sealed record PreparationSelectionRequest(string ExpectedAccountId);
public sealed record PreparationSelectionView(string OpportunityId, string Title, string Organizer, string SelectedAt, string AccessState);
[ApiController]
public sealed class PreparationSelectionsController(IStateStore store, Accounts accounts, DiscoveryFeed feed, Catalog catalog) : ControllerBase {
    private async Task<string> Owner(string? expected, CancellationToken ct) {
        var account = await accounts.Me(Request.Cookies["nextstep-session"], ct);
        if (account is null) throw new ApiFault("invalid_input", "Sign in to save preparation choices.");
        if (expected is not null && expected != account.Id) throw new ApiFault("version_conflict", "Your signed-in account changed. No preparation choice was updated.");
        return (string)HttpContext.Items["owner"]!;
    }
    private string Access(ListingSummary? listing) => listing is null ? "unavailable" : PreparationAccess.For(listing, catalog.All().SingleOrDefault(o => o.Id == listing.Id)).State;
    [HttpGet("/api/preparation-selections")]
    public async Task<PreparationSelectionView[]> Read(CancellationToken ct) {
        var owner = await Owner(null, ct);
        var selections = await store.Read(owner, state => state.PreparationSelections.Values.OrderByDescending(s => s.SelectedAt, StringComparer.Ordinal).ToArray(), ct);
        if (selections.Length == 0) return [];
        var listings = await feed.Listings(ct);
        return selections.Select(s => new PreparationSelectionView(s.OpportunityId, s.Title, s.Organizer, s.SelectedAt, Access(listings.SingleOrDefault(l => l.Id == s.OpportunityId)))).ToArray();
    }
    [HttpPut("/api/preparation-selections/{id}")]
    public async Task<PreparationSelectionView> Select(string id, PreparationSelectionRequest request, CancellationToken ct) {
        var owner = await Owner(request.ExpectedAccountId, ct);
        var listing = (await feed.Listings(ct)).SingleOrDefault(l => l.Id == id) ?? throw new ApiFault("not_found", "This opportunity is unavailable. Your other preparation choices are unchanged.");
        Input.Require(listing.Kind == "hackathon", "Preparation currently supports hackathons.");
        var saved = await store.Change(owner, state => {
            if (state.PreparationSelections.TryGetValue(id, out var previous)) return previous;
            var selection = new PreparationSelection(id, listing.Title, listing.Organizer, DateTimeOffset.UtcNow.ToString("O"));
            state.PreparationSelections[id] = selection; return selection;
        }, ct);
        return new(saved.OpportunityId, saved.Title, saved.Organizer, saved.SelectedAt, Access(listing));
    }
    [HttpDelete("/api/preparation-selections/{id}")]
    public async Task<IActionResult> Remove(string id, PreparationSelectionRequest request, CancellationToken ct) {
        var owner = await Owner(request.ExpectedAccountId, ct);
        await store.Change(owner, state => state.PreparationSelections.Remove(id), ct);
        return Ok(new { confirmed = true });
    }
}
