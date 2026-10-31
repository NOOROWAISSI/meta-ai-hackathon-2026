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
    public FakeEmailSender Email { get; } = new();
    public FakeGoogleBackchannel Google { get; } = new();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:NextStep"] = Environment.GetEnvironmentVariable("NEXTSTEP_CHECKS_CONNECTION") ?? throw new InvalidOperationException("Set NEXTSTEP_CHECKS_CONNECTION to the dedicated local MySQL instance.") }));
        if (fake) builder.ConfigureTestServices(services => { services.RemoveAll<IMetaModelClient>(); services.AddSingleton<IMetaModelClient>(Model); });
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
        return new([new(Prefix + " the walkthrough", new("goal", goal), "should", "A short walkthrough draft", "Explain the implemented flow and its limitations", 2, []), new(Prefix + " the prototype", new("goal", goal), "could", "One small demonstrable interaction", "Run the example and list unfinished work", 1, [])], "Synthetic provider used only by the test host; timing is assessed by the application.");
    }
}
