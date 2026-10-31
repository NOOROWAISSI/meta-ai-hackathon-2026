using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/opportunities")]
public sealed class OpportunitiesController(Catalog catalog, Application service, ResourceCatalog resources, DiscoveryFeed discovery) : ControllerBase
{
    [HttpGet]
    public Opportunity[] Get() => catalog.All();
    [HttpGet("{id}")]
    public Opportunity Get(string id) => catalog.Get(id);
    [HttpGet("{id}/preparation-access")]
    public async Task<PreparationAccess> Access(string id, CancellationToken ct)
    {
        var listing = (await discovery.Listings(ct)).SingleOrDefault(item => item.Id == id)
            ?? throw new ApiFault("not_found", "This opportunity is unavailable.");
        return PreparationAccess.For(listing, catalog.All().SingleOrDefault(item => item.Id == id));
    }
    [HttpGet("{id}/resources")]
    public LearningResource[] Resources(string id) => resources.For(catalog.Get(id));
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
