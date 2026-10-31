using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace NextStep.Api.Controllers;
[ApiController]
public sealed class PersonalBriefingController(PersonalBriefingService service, Accounts accounts) : ControllerBase
{
    [HttpPut("/api/listings/{id}/starting-point")]
    public async Task<IActionResult> SaveStartingPoint(string id, StartingPointUpdate request, CancellationToken ct) {
        if (await accounts.Me(Request.Cookies["nextstep-session"], ct) is null) return Unauthorized(new ApiError("invalid_input", "Sign in before confirming profile information.", Guid.NewGuid().ToString("N"), false));
        return Ok(await service.SaveStartingPoint((string)HttpContext.Items["owner"]!, id, request, ct));
    }
    [HttpPost("/api/listings/{id}/briefing")]
    [EnableRateLimiting("generation")]
    public async Task<IActionResult> Explain(string id, BriefingRequest request, CancellationToken ct) {
        if (await accounts.Me(Request.Cookies["nextstep-session"], ct) is null) return Unauthorized(new ApiError("invalid_input", "Sign in before requesting a personal explanation.", Guid.NewGuid().ToString("N"), false));
        return Ok(await service.Explain((string)HttpContext.Items["owner"]!, id, request, ct));
    }
}
