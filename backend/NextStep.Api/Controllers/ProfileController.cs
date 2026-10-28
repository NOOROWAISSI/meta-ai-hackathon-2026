using Microsoft.AspNetCore.Mvc;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/profile")]
public sealed class ProfileController(Application service, IStateStore store) : ControllerBase
{
    private string Owner => (string)HttpContext.Items["owner"]!;
    [HttpGet]
    public Task<StudentProfile> Get(CancellationToken ct) => store.Read(Owner, state => state.Profile, ct);
    [HttpPut]
    public Task<StudentProfile> Save(ProfileUpdate update, CancellationToken ct) => service.SaveProfile(Owner, update, ct);
}
