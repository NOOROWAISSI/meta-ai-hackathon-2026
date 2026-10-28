using Microsoft.AspNetCore.Mvc;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/submissions")]
public sealed class SubmissionsController(Application service, IStateStore store, Catalog catalog) : ControllerBase
{
    private string Owner => (string)HttpContext.Items["owner"]!;
    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct) => Ok(await store.Read(Owner, state => Application.Submission(state, catalog.Get(id)), ct));
    [HttpPut("{id}")]
    public async Task<IActionResult> Save(string id, SubmissionUpdate update, CancellationToken ct) => Ok(await service.SaveSubmission(Owner, id, update, ct));
}
