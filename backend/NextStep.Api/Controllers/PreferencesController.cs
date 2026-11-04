using Microsoft.AspNetCore.Mvc;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/preferences")]
public sealed class PreferencesController(IStateStore store, DiscoveryFeed feed) : ControllerBase
{
    private string Owner => (string)HttpContext.Items["owner"]!;
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await store.Read(Owner, state => state.Preferences.Values.ToArray(), ct));
    [HttpPut("{id}")]
    public async Task<IActionResult> Save(string id, OpportunityPreference preference, CancellationToken ct)
    {
        await RequireListing(id, ct); Input.Require(preference.OpportunityId == id);
        return Ok(await store.Change(Owner, state => { SetSavedTime(state, id, preference.Saved); state.Preferences[id] = preference; return preference; }, ct));
    }
    private async Task RequireListing(string id, CancellationToken ct) { if (!(await feed.Listings(ct)).Any(item => item.Id == id)) throw new ApiFault("not_found", "This opportunity is unavailable."); }
    private static void SetSavedTime(UserState state, string id, bool saved) { if (saved && state.Preferences.GetValueOrDefault(id)?.Saved != true) state.SavedAt[id] = DateTimeOffset.UtcNow.ToString("O"); }
    [HttpGet("snapshot")]
    public Task<PreferenceView[]> Snapshot(CancellationToken ct) => store.Read(Owner, state => state.Preferences.Values.Select(p => new PreferenceView(p.OpportunityId, p.Saved, p.NotInterested, state.SavedAt.GetValueOrDefault(p.OpportunityId))).ToArray(), ct);
    [HttpPatch("{id}")]
    public async Task<PreferenceView> Change(string id, PreferenceChange change, [FromServices] Accounts accounts, CancellationToken ct) {
        await RequireListing(id, ct); Input.Require(change.Saved.HasValue || change.NotInterested.HasValue);
        if (change.ExpectedAccountId is not null && (await accounts.Me(Request.Cookies["nextstep-session"], ct))?.Id != change.ExpectedAccountId) throw new ApiFault("version_conflict", "Your signed-in account changed. No preference was updated.");
        return await store.Change(Owner, state => {
            var old = state.Preferences.GetValueOrDefault(id) ?? new(id, false, false);
            var next = old with { Saved = change.Saved ?? old.Saved, NotInterested = change.NotInterested ?? old.NotInterested };
            SetSavedTime(state, id, next.Saved); state.Preferences[id] = next;
            return new PreferenceView(id, next.Saved, next.NotInterested, state.SavedAt.GetValueOrDefault(id));
        }, ct);
    }
}
