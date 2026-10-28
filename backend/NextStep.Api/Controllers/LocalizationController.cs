using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/localization")]
public sealed class LocalizationController(CatalogTranslationService service) : ControllerBase
{
    [HttpPost("catalog")]
    [EnableRateLimiting("generation")]
    public Task<CatalogTranslation> Catalog(CatalogTranslationRequest request, CancellationToken ct) => service.Translate(request.Language, ct);
}
