using Microsoft.AspNetCore.Mvc;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/profile")]
public sealed class ProfileController(Application service, IStateStore store) : ControllerBase
{
    private string Owner => (string)HttpContext.Items["owner"]!;
    [HttpGet]
    public Task<StudentProfile> Get(CancellationToken ct) => store.Read(Owner, state => state.Profile, ct);
    [HttpGet("disclosure")]
    public Task<DisclosureStatus> GetDisclosure(CancellationToken ct) => store.Read(Owner, state => Disclosure.Status(state), ct);
    [HttpPost("disclosure/acknowledge")]
    public Task<DisclosureStatus> AcknowledgeDisclosure(CancellationToken ct) => store.Change(Owner, state => Disclosure.Acknowledge(state), ct);
    [HttpPost("disclosure/withdraw")]
    public Task<DisclosureStatus> WithdrawDisclosure(CancellationToken ct) => store.Change(Owner, state => Disclosure.Withdraw(state), ct);
    [HttpPut]
    public Task<StudentProfile> Save(ProfileUpdate update, CancellationToken ct) => service.SaveProfile(Owner, update, ct);
    [HttpGet("editor")]
    public async Task<ProfileEditorView> Editor([FromServices] Accounts accounts, CancellationToken ct) {
        var account = await accounts.Me(Request.Cookies["nextstep-session"], ct);
        return await store.Read(Owner, state => new ProfileEditorView(state.Profile, state.ProfileEditor, account?.DisplayName ?? ""), ct);
    }
    [HttpPut("editor")]
    public Task<ProfileEditorView> SaveEditor(ProfileEditorUpdate update, CancellationToken ct) {
        Input.Profile(update.Profile); ProfileEditorValidation.Validate(update.Editor);
        return store.Change(Owner, state => {
            if (state.Profile.Id != update.Profile.Id || state.Profile.Version != update.ExpectedVersion || update.Profile.Version != update.ExpectedVersion) throw new ApiFault("version_conflict", "Your account profile changed. Your draft is kept; reload and compare before saving.");
            state.Profile = Wire.Copy(update.Profile with { Version = checked(update.ExpectedVersion + 1) });
            state.ProfileEditor = Wire.Copy(update.Editor);
            state.ProfileEditor["version"] = state.Profile.Version;
            state.ProfileEditor["savedAt"] = DateTimeOffset.UtcNow.ToString("O");
            return new ProfileEditorView(state.Profile, state.ProfileEditor, state.ProfileEditor["displayName"]?.GetValue<string>() ?? "");
        }, ct);
    }
}
