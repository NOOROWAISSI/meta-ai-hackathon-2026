using Microsoft.AspNetCore.Mvc;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/plans")]
public sealed class PlansController(Application service, IStateStore store) : ControllerBase
{
    private string Owner => (string)HttpContext.Items["owner"]!;
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await store.Read(Owner, state => state.Plans.Values.ToArray(), ct));
    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct) => Ok(await store.Read(Owner, state => state.Plans.GetValueOrDefault(id) ?? throw new ApiFault("not_found", "No accepted plan exists for this opportunity."), ct));
    [HttpPost("{id}/accept")]
    public async Task<IActionResult> Accept(string id, AcceptPlan request, CancellationToken ct) => Ok(await service.Accept(Owner, id, request, ct));
    [HttpPatch("{id}/tasks/{taskId}")]
    public async Task<IActionResult> Progress(string id, string taskId, TaskUpdate request, CancellationToken ct) => Ok(await service.Progress(Owner, id, taskId, request, ct));
    [HttpDelete("/api/candidates/{id}")]
    public async Task<IActionResult> Discard(string id, CancellationToken ct) => Ok(await store.Change(Owner, state => { state.Candidates.Remove(id); return new { discarded = true }; }, ct));
}
