using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NextStep.MetaAi;

public sealed class Factory(bool fake = true, bool recovery = false, bool google = false) : WebApplicationFactory<NextStep.Api.ApiAssemblyMarker>
{
    public FakeModel Model { get; } = new();
    public FakePersonalBriefingModel Briefing { get; } = new();
    public FakeEmailSender Email { get; } = new();
    public FakeGoogleBackchannel Google { get; } = new();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:NextStep"] = Environment.GetEnvironmentVariable("NEXTSTEP_CHECKS_CONNECTION") ?? throw new InvalidOperationException("Set NEXTSTEP_CHECKS_CONNECTION to the dedicated local MySQL instance.") }));
        if (fake) builder.ConfigureTestServices(services => { services.RemoveAll<IMetaModelClient>(); services.AddSingleton<IMetaModelClient>(Model); services.RemoveAll<NextStep.Api.IPersonalBriefingModel>(); services.AddSingleton<NextStep.Api.IPersonalBriefingModel>(Briefing); });
        if (google) {
            builder.UseSetting("Authentication:Google:ClientId", "synthetic-client.apps.googleusercontent.com");
            builder.UseSetting("Authentication:Google:ClientSecret", "synthetic-test-only-client-secret");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> { ["Authentication:Google:ClientId"] = "synthetic-client.apps.googleusercontent.com", ["Authentication:Google:ClientSecret"] = "synthetic-test-only-client-secret" }));
            builder.ConfigureTestServices(services => services.PostConfigure<Microsoft.AspNetCore.Authentication.Google.GoogleOptions>(Microsoft.AspNetCore.Authentication.Google.GoogleDefaults.AuthenticationScheme, options => options.Backchannel = new HttpClient(Google)));
        }
        if (recovery) {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> { ["Authentication:RecoveryPepper"] = "synthetic-test-only-pepper-at-least-32-characters" }));
            builder.ConfigureTestServices(services => { services.RemoveAll<NextStep.Api.IEmailSender>(); services.AddSingleton<NextStep.Api.IEmailSender>(Email); });
        }
    }
}
public sealed class FakeModel : IMetaModelClient
{
    public PlanGenerationContext? LastContext;
    public int Calls;
    public string? ErrorCode;
    public bool Invalid;
    public bool Arbitrary;
    public bool VideoPlan;
    public TaskCompletionSource? Entered;
    public TaskCompletionSource? Resume;
    public string Prefix = "Practice";
    public async Task<PlanCandidateOutput> GenerateCandidateAsync(PlanGenerationContext context, CancellationToken ct = default)
    {
        Calls++;
        LastContext = context;
        Entered?.TrySetResult();
        if (Resume is not null) await Resume.Task.WaitAsync(ct);
        if (ErrorCode is { } code) throw new MetaAiException(code, "Test provider failure", true);
        var goal = Invalid ? "dangling-goal" : context.Goals.First().Id;
        if (Arbitrary) return new([], "You qualify to participate and are approved for entry.");
        if (VideoPlan) {
            var rule = context.ReviewedRequirements.Single(r => r.Deliverable?.Type == "video");
            var selections = new[] { "record_video", "verify_channel", "deliver", "confirm_receipt" }.Select(action => new PlanActionSelection(action, new("requirement", RequirementId: rule.Id), "must", 1, Array.Empty<string>())).ToArray();
            return PlanActionRenderer.Render(selections, "unknown", context);
        }
        var actions = Prefix switch { "Replacement" => new[] { "explore", "adapt" }, "Fresh" or "Extend" => new[] { "adapt", "explore" }, _ => new[] { "clarify", "prototype" } };
        return PlanActionRenderer.Render([new(actions[0], new("goal", goal), "should", 2, []), new(actions[1], new("goal", goal), "could", 1, [])], "prepare", context);
    }
}
