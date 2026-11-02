using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace NextStep.Api.Controllers;

public sealed record TextSourceRequest(string Kind, string Title, string Text, string? Url, int ProfileVersion, int SourcesVersion);
public sealed record GitHubSourceRequest(string Url, int ProfileVersion, int SourcesVersion);
public sealed record DeleteSourceRequest(int ProfileVersion, int SourcesVersion);

[ApiController]
public sealed class ProfileEvidenceController(ProfileEvidenceService service, PublicGitHubSources github, Accounts accounts) : ControllerBase {
    private async Task<string> Owner(CancellationToken ct) {
        if (await accounts.Me(Request.Cookies["nextstep-session"], ct) is null) throw new ApiFault("invalid_input", "Sign in to manage your private professional sources.");
        return (string)HttpContext.Items["owner"]!;
    }
    [HttpGet("/api/profile/evidence")]
    public async Task<IActionResult> Read(CancellationToken ct) => Ok(await service.Read(await Owner(ct), ct));
    [HttpPost("/api/profile/evidence/text")]
    public async Task<IActionResult> Text(TextSourceRequest request, CancellationToken ct) => Ok(await service.Add(await Owner(ct), ProfessionalDocuments.Text(request.Kind, request.Title, request.Text, request.Url), request.ProfileVersion, request.SourcesVersion, ct));
    [HttpPost("/api/profile/evidence/upload")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file, [FromForm] string kind, [FromForm] int profileVersion, [FromForm] int sourcesVersion, CancellationToken ct) {
        var owner = await Owner(ct);
        Input.Require(file is not null && file.Length is > 0 and <= ProfessionalDocuments.MaxBytes, "Upload a PDF or DOCX up to 5 MB.");
        using var bytes = new MemoryStream(); await file!.CopyToAsync(bytes, ct);
        return Ok(await service.Add(owner, ProfessionalDocuments.Parse(file.FileName, bytes.ToArray(), kind), profileVersion, sourcesVersion, ct));
    }
    [HttpGet("/api/profile/evidence/github")]
    public async Task<IActionResult> Repositories([FromQuery] string account, CancellationToken ct) { await Owner(ct); return Ok(await github.Repositories(account, ct)); }
    [HttpPost("/api/profile/evidence/github")]
    [EnableRateLimiting("generation")]
    public async Task<IActionResult> GitHub(GitHubSourceRequest request, CancellationToken ct) {
        var owner = await Owner(ct); return Ok(await service.Add(owner, await github.Import(request.Url, ct), request.ProfileVersion, request.SourcesVersion, ct));
    }
    [HttpDelete("/api/profile/evidence/{id}")]
    public async Task<IActionResult> Delete(string id, DeleteSourceRequest request, CancellationToken ct) => Ok(await service.Delete(await Owner(ct), id, request.ProfileVersion, request.SourcesVersion, ct));
    [HttpPost("/api/profile/evidence/analyze")]
    [EnableRateLimiting("generation")]
    public async Task<IActionResult> Analyze(EvidenceAnalysisRequest request, CancellationToken ct) => Ok(await service.Analyze(await Owner(ct), request, ct));
    [HttpPost("/api/profile/evidence/accept")]
    public async Task<IActionResult> Accept(EvidenceAcceptance request, CancellationToken ct) => Ok(await service.Accept(await Owner(ct), request, ct));
    [HttpPost("/api/listings/{id}/evidence-comparison")]
    [EnableRateLimiting("generation")]
    public async Task<IActionResult> Compare(string id, InsightRequest request, CancellationToken ct) => Ok(await service.Compare(await Owner(ct), id, request, ct));
    [HttpGet("/api/listings/{id}/evidence-comparison")]
    public async Task<IActionResult> SavedComparison(string id, [FromQuery] string language, CancellationToken ct) => new JsonResult(await service.SavedComparison(await Owner(ct), id, language, ct));
    [HttpPost("/api/listings/{id}/comparison-answer")]
    public async Task<IActionResult> Answer(string id, ComparisonAnswer request, CancellationToken ct) => Ok(await service.Answer(await Owner(ct), id, request, ct));
    [HttpPost("/api/listings/{id}/comparison-correction")]
    public async Task<IActionResult> Correct(string id, ExperienceCorrection request, CancellationToken ct) => Ok(await service.CorrectExperience(await Owner(ct), id, request, ct));
}
