using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using MySqlConnector;
using NextStep.Api;
using NextStep.MetaAi;

var builder = WebApplication.CreateBuilder(args);
if (builder.Environment.IsDevelopment()) {
    builder.Configuration.AddJsonFile(Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", ".secrets", "email.json")), optional: true, reloadOnChange: false)
        .AddJsonFile(Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", ".secrets", "google.json")), optional: true, reloadOnChange: false)
        .AddJsonFile(Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", ".secrets", "meta.json")), optional: true, reloadOnChange: false).AddEnvironmentVariables();
}
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 786432);
builder.Services.ConfigureHttpJsonOptions(options => { options.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow; options.SerializerOptions.MaxDepth = 32; });
builder.Services.AddControllers().AddJsonOptions(options => {
    options.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
    options.JsonSerializerOptions.MaxDepth = 32;
}).ConfigureApiBehaviorOptions(options => {
    options.InvalidModelStateResponseFactory = _ => new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new ApiError("invalid_input", "The request does not match the v0.2 contract.", Guid.NewGuid().ToString("N"), false));
});
builder.Services.AddSingleton<Catalog>();
builder.Services.AddSingleton<DiscoveryCatalog>();
builder.Services.AddSingleton<ResourceCatalog>();
builder.Services.AddHttpClient<IPersonalBriefingModel, MetaPersonalBriefingModel>(client => client.Timeout = TimeSpan.FromSeconds(95)).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false, PooledConnectionLifetime = TimeSpan.FromMinutes(5) });
builder.Services.AddSingleton<PersonalBriefingService>();
builder.Services.AddSingleton<SourceCollector>();
builder.Services.AddSingleton<DiscoveryFeed>();
builder.Services.AddSingleton<IOfficialPageReader, OfficialPageReader>();
builder.Services.AddHostedService<SourceCollectionWorker>();
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<PasswordRecoveryRepository>();
builder.Services.AddScoped<PasswordRecoveryService>();
builder.Services.AddSingleton<DemoStudentSeed>();
builder.Services.AddSingleton<MySqlStateStore>();
builder.Services.AddSingleton<IStateStore>(services => services.GetRequiredService<MySqlStateStore>());
builder.Services.AddScoped<NextStep.Api.Application>();
builder.Services.AddMetaAiClient(builder.Configuration);
builder.ConfigureAccounts();
builder.Services.AddRateLimiter(options => {
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http => RateLimitPartition.GetFixedWindowLimiter(http.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new() { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy("generation", http => RateLimitPartition.GetFixedWindowLimiter(http.Items["owner"] as string ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new() { PermitLimit = 6, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy("accounts", http => RateLimitPartition.GetFixedWindowLimiter(http.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new() { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.OnRejected = async (context, ct) => { context.HttpContext.Response.StatusCode = 429; await context.HttpContext.Response.WriteAsJsonAsync(new ApiError("rate_limited", "Too many requests. Retry shortly.", Guid.NewGuid().ToString("N"), true), cancellationToken: ct); };
});
var app = builder.Build();
app.Use(async (http, next) => {
    http.Response.Headers.CacheControl = "no-store";
    http.Response.Headers["X-Content-Type-Options"] = "nosniff";
    try { await next(http); }
    catch (OperationCanceledException) when (http.RequestAborted.IsCancellationRequested) { http.Response.StatusCode = 499; }
    catch (Exception error) {
        var failure = error switch {
            ApiFault fault => fault.Error,
            MetaAiException ai => new ApiError(ai.Error.Code, ai.Error.Message, ai.Error.RequestId, ai.Error.Retryable),
            BadHttpRequestException or JsonException or InvalidOperationException or FormatException => new ApiError("invalid_input", "The request does not match the v0.2 contract.", Guid.NewGuid().ToString("N"), false),
            MySqlException => new ApiError("provider_unavailable", "Application storage is unavailable. The last confirmed data is preserved; retry shortly.", Guid.NewGuid().ToString("N"), true),
            _ => new ApiError("provider_unavailable", "The operation could not be completed. Retry shortly.", Guid.NewGuid().ToString("N"), true)
        };
        if (!http.Response.HasStarted) { http.Response.StatusCode = failure.Code switch { "invalid_input" => 400, "not_found" => 404, "version_conflict" => 409, "rate_limited" => 429, "timeout" => 504, _ => 503 }; await http.Response.WriteAsJsonAsync(failure, cancellationToken: http.RequestAborted); }
    }
});
app.Use(async (http, next) => {
    if (HttpMethods.IsPost(http.Request.Method) || HttpMethods.IsPut(http.Request.Method) || HttpMethods.IsPatch(http.Request.Method) || HttpMethods.IsDelete(http.Request.Method)) {
        var origin = http.Request.Headers.Origin.ToString();
        var allowed = (builder.Configuration["AllowedOrigins"] ?? "http://127.0.0.1:8082;http://localhost:8082;http://127.0.0.1:8080;http://localhost:8080").Split(';');
        if (http.Request.Headers["X-NextStep-Request"] != "1" || (origin.Length > 0 && !allowed.Contains(origin, StringComparer.Ordinal))) { http.Response.StatusCode = 403; await http.Response.WriteAsJsonAsync(new ApiError("invalid_input", "Use an authorized same-origin application request.", Guid.NewGuid().ToString("N"), false)); return; }
    }
    var isPublic = HttpMethods.IsGet(http.Request.Method) && (http.Request.Path.StartsWithSegments("/api/opportunities") || http.Request.Path == "/api/listings" || http.Request.Path == "/api/sources" || http.Request.Path == "/api/sources/status" || http.Request.Path == "/api/health");
    if (http.Request.Path.StartsWithSegments("/api") && http.Request.Path != "/api/session" && !http.Request.Path.StartsWithSegments("/api/auth") && !isPublic) {
        var owner = http.Request.Cookies.TryGetValue("nextstep-session", out var token) ? await http.RequestServices.GetRequiredService<IStateStore>().ResolveSession(token, http.RequestAborted) : null;
        if (owner is null) { http.Response.StatusCode = 401; await http.Response.WriteAsJsonAsync(new ApiError("invalid_input", "Start an anonymous session to access saved information.", Guid.NewGuid().ToString("N"), false)); return; }
        http.Items["owner"] = owner;
    }
    await next(http);
});
app.UseRateLimiter();
app.UseAuthentication();
app.MapControllers();
if (args.Contains("--migrate")) { await app.Services.GetRequiredService<MySqlStateStore>().Migrate(CancellationToken.None); Console.WriteLine("MySQL migrations applied through version 5."); return; }
if (args.Contains("--seed-students")) {
    var result = await app.Services.GetRequiredService<DemoStudentSeed>().Run(DemoStudentSeed.Students, CancellationToken.None);
    Console.WriteLine($"Demo students: {result.Created} created, {result.Skipped} already present and unchanged. See backend/DEMO-STUDENTS.md for test sign-in details.");
    return;
}
if (args.Contains("--collect-sources")) {
    var index = Array.IndexOf(args, "--source");
    var sources = app.Services.GetRequiredService<DiscoveryCatalog>().Sources();
    if (index >= 0) {
        var id = index + 1 < args.Length ? args[index + 1] : null;
        sources = sources.Where(source => source.Id == id).ToArray();
        if (sources.Length == 0) { Console.Error.WriteLine("Choose a registered source ID. No collection was made."); Environment.ExitCode = 1; return; }
    }
    await app.Services.GetRequiredService<SourceCollector>().CollectSources(sources, true, CancellationToken.None);
    Console.WriteLine("Collection complete. Check /api/sources/status for confirmed results; missing details remain unconfirmed.");
    return;
}
app.Run();
public partial class Program;
