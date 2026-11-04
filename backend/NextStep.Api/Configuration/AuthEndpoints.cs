using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.WebUtilities;

namespace NextStep.Api;

public static class AuthEndpoints
{
    public static bool GoogleEnabled(IConfiguration config) => !string.IsNullOrWhiteSpace(config["Authentication:Google:ClientId"]) && !string.IsNullOrWhiteSpace(config["Authentication:Google:ClientSecret"]);
    public static void ConfigureAccounts(this WebApplicationBuilder builder)
    {
        builder.Services.AddSingleton<Accounts>();
        var auth = builder.Services.AddAuthentication("GoogleExternal").AddCookie("GoogleExternal", options => { options.Cookie.Name = "nextstep-google-external"; options.Cookie.Path = "/api/auth"; options.Cookie.HttpOnly = true; options.ExpireTimeSpan = TimeSpan.FromMinutes(5); });
        if (GoogleEnabled(builder.Configuration)) auth.AddGoogle(options => {
            options.SignInScheme = "GoogleExternal";
            options.ClientId = builder.Configuration["Authentication:Google:ClientId"]!;
            options.ClientSecret = builder.Configuration["Authentication:Google:ClientSecret"]!;
            options.CallbackPath = "/api/auth/google/callback";
            options.SaveTokens = false;
            options.UsePkce = true;
            options.CorrelationCookie.SameSite = SameSiteMode.Lax;
            options.CorrelationCookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
            options.Events.OnCreatingTicket = context => {
                var verified = context.User.TryGetProperty("verified_email", out var first) && first.ValueKind == System.Text.Json.JsonValueKind.True || context.User.TryGetProperty("email_verified", out var second) && second.ValueKind == System.Text.Json.JsonValueKind.True;
                if (!verified) throw new AuthenticationFailureException("A verified Google email is required.");
                return Task.CompletedTask;
            };
            options.Events.OnTicketReceived = async context => {
                try {
                    var accounts = context.HttpContext.RequestServices.GetRequiredService<Accounts>();
                    var principal = context.Principal ?? throw new AuthenticationFailureException("Google identity is missing.");
                    var result = await accounts.Google(principal.FindFirstValue(ClaimTypes.NameIdentifier)!, principal.FindFirstValue(ClaimTypes.Email)!, principal.FindFirstValue(ClaimTypes.Name) ?? "", context.HttpContext.RequestAborted);
                    Cookie(context.HttpContext, result.Token, builder.Environment);
                    context.HandleResponse(); context.Response.Redirect(context.ReturnUri ?? "/");
                } catch (ApiFault) { context.HandleResponse(); context.Response.Redirect(GoogleFailureReturn(context.ReturnUri, "existing_account")); }
            };
            options.Events.OnRemoteFailure = context => { context.HandleResponse(); context.Response.Redirect(GoogleFailureReturn(context.Properties?.RedirectUri, "google_failed")); return Task.CompletedTask; };
        });
    }
    public static void Cookie(HttpContext http, string token, IWebHostEnvironment environment) => http.Response.Cookies.Append("nextstep-session", token, new CookieOptions { HttpOnly = true, Secure = !environment.IsDevelopment() && !environment.IsEnvironment("Testing"), SameSite = SameSiteMode.Strict, Path = "/api", MaxAge = TimeSpan.FromDays(30), IsEssential = true });
    private static string GoogleFailureReturn(string? redirect, string error) {
        var destination = redirect is not null && redirect.StartsWith("/login?", StringComparison.Ordinal) ? SafeReturn(QueryHelpers.ParseQuery(redirect[redirect.IndexOf('?')..])["returnTo"].FirstOrDefault()) : "/";
        return "/login?error=" + error + "&returnTo=" + Uri.EscapeDataString(destination);
    }
    public static string SafeReturn(string? value) => value is not null && value.StartsWith('/') && !value.StartsWith("//") && !value.Contains('\\') && !value.Any(char.IsControl) && new[] { "/", "/saved", "/plans", "/profile", "/opportunities" }.Contains(value.Split('?')[0]) ? value : "/";
}
