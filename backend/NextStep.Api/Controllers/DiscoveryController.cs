using Microsoft.AspNetCore.Mvc;

namespace NextStep.Api.Controllers;

[ApiController]
public sealed class DiscoveryController(DiscoveryCatalog catalog) : ControllerBase
{
    [HttpGet("/api/listings")]
    public ListingSummary[] Listings() => catalog.Listings();
    [HttpGet("/api/sources")]
    public SourceRegistration[] Sources() => catalog.Sources();
}
