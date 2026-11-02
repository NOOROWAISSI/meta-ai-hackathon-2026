using Microsoft.AspNetCore.Mvc;

namespace NextStep.Api.Controllers;

[ApiController]
public sealed class DiscoveryController(DiscoveryCatalog catalog, DiscoveryFeed feed, PalestineNetwork network) : ControllerBase
{
    [HttpGet("/api/listings")]
    public Task<ListingSummary[]> Listings(CancellationToken ct) => feed.Listings(ct);
    [HttpGet("/api/sources")]
    public SourceRegistration[] Sources() => catalog.Sources();
    [HttpGet("/api/sources/status")]
    public Task<CollectionStatus> Status(CancellationToken ct) => feed.Status(ct);
    [HttpGet("/api/sources/network")]
    public PalestineNetworkView Network() => network.Read();
}
