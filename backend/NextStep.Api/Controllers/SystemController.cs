using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using NextStep.MetaAi;

namespace NextStep.Api.Controllers;

[ApiController]
public sealed class SystemController(IStateStore store, IOptions<MetaAiOptions> options, IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet("/")]
    public object Index() => new { application = "NextStep API", contract = "v0.2", health = "/api/health", catalog = "/api/opportunities", storage = "MySQL", meta = "Rofi's server-side adapter; no mock generation in this host" };
    [HttpGet("/api/health")]
    public async Task<IActionResult> Health(CancellationToken ct)
    {
        var healthy = await store.Healthy(ct);
        return StatusCode(healthy ? 200 : 503, new { status = healthy ? "ok" : "storage_unavailable", storage = "mysql", modelConfigured = !string.IsNullOrWhiteSpace(options.Value.ApiKey) });
    }
    [HttpPost("/api/session")]
    public async Task<IActionResult> Session(CancellationToken ct)
    {
        if (Request.Cookies.TryGetValue("nextstep-session", out var existing) && await store.ResolveSession(existing, ct) is not null) return Ok(new { session = "active" });
        AuthEndpoints.Cookie(HttpContext, await store.CreateSession(ct), environment);
        return Ok(new { session = "created", persistence = "same-browser MySQL-backed anonymous session" });
    }
    [HttpGet("/api/data/export")]
    public async Task<IActionResult> Export(CancellationToken ct) => Ok(await store.Read((string)HttpContext.Items["owner"]!, state => new { schemaVersion = state.SchemaVersion, profile = state.Profile, profileEditor = state.ProfileEditor, submissions = state.Submissions, plans = state.Plans.ToDictionary(p => p.Key, p => PlanDisplay.Project(state, p.Key, p.Value)!), preferences = state.Preferences, savedAt = state.SavedAt }, ct));
    [HttpDelete("/api/data")]
    public async Task<IActionResult> Delete(CancellationToken ct)
    {
        await store.Delete((string)HttpContext.Items["owner"]!, ct);
        Response.Cookies.Delete("nextstep-session", new CookieOptions { Path = "/api" });
        return NoContent();
    }
}
