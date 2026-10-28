using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/opportunities")]
public sealed class OpportunitiesController(Catalog catalog, Application service) : ControllerBase
{
    [HttpGet]
    public Opportunity[] Get() => catalog.All();
    [HttpGet("{id}")]
    public Opportunity Get(string id) => catalog.Get(id);
    [HttpGet("{id}/resources")]
    public object[] Resources(string id) { catalog.Get(id); return []; }
    [HttpPost("{id}/analysis")]
    public async Task<IActionResult> Analyze(string id, AnalysisRequest request, CancellationToken ct) => Ok(await service.Analyze((string)HttpContext.Items["owner"]!, id, request, ct));
    [HttpPost("{id}/plan-candidates")]
    [HttpPost("{id}/preparation/candidates")]
    [EnableRateLimiting("generation")]
    public async Task<IActionResult> Generate(string id, AnalysisRequest request, CancellationToken ct)
    {
        var candidate = await service.Generate((string)HttpContext.Items["owner"]!, id, request, ct);
        Response.Headers["X-Candidate-Id"] = candidate.Id;
        return new JsonResult(candidate.Output, Wire.Json);
    }
}
