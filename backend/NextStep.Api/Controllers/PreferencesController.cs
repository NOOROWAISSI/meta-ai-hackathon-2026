using Microsoft.AspNetCore.Mvc;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/preferences")]
public sealed class PreferencesController(IStateStore store, Catalog catalog) : ControllerBase
{
    private string Owner => (string)HttpContext.Items["owner"]!;
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await store.Read(Owner, state => state.Preferences.Values.ToArray(), ct));
    [HttpPut("{id}")]
    public async Task<IActionResult> Save(string id, OpportunityPreference preference, CancellationToken ct)
    {
        catalog.Get(id); Input.Require(preference.OpportunityId == id);
        return Ok(await store.Change(Owner, state => { state.Preferences[id] = preference; return preference; }, ct));
    }
}
