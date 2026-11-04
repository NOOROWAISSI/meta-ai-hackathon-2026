using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace NextStep.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(Accounts accounts, IConfiguration config, IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("request-password-reset")]
    [EnableRateLimiting("accounts")]
    public Task<PasswordChallenge> RequestPasswordReset(RequestPasswordCode request, [FromServices] PasswordRecoveryService recovery, CancellationToken ct) => recovery.Request(request, ct);
    [HttpPost("verify-password-reset")]
    [EnableRateLimiting("accounts")]
    public async Task<IActionResult> VerifyPasswordReset(VerifyPasswordCode request, [FromServices] PasswordRecoveryService recovery, CancellationToken ct) => Ok(new { resetToken = await recovery.Verify(request, ct) });
    [HttpPost("reset-password")]
    [EnableRateLimiting("accounts")]
    public async Task<IActionResult> ResetPassword(ResetPassword request, [FromServices] PasswordRecoveryService recovery, CancellationToken ct) { await recovery.Reset(request, ct); return NoContent(); }
    [HttpGet("config")]
    public object Config() => new { googleEnabled = AuthEndpoints.GoogleEnabled(config), passwordEnabled = true };
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct) => Ok(new { user = await accounts.Me(Request.Cookies["nextstep-session"], ct) });
    [HttpPost("register")]
    [EnableRateLimiting("accounts")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        var result = await accounts.Register(request, ct);
        AuthEndpoints.Cookie(HttpContext, result.Token, environment);
        return Ok(result.Account);
    }
    [HttpPost("login")]
    [EnableRateLimiting("accounts")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var result = await accounts.Login(request, ct);
        if (result is null) return Unauthorized(new ApiError("invalid_input", "Email or password is incorrect.", Guid.NewGuid().ToString("N"), false));
        AuthEndpoints.Cookie(HttpContext, result.Value.Token, environment);
        return Ok(result.Value.Account);
    }
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await accounts.Logout(Request.Cookies["nextstep-session"], ct);
        Response.Cookies.Delete("nextstep-session", new CookieOptions { Path = "/api" });
        return NoContent();
    }
    [HttpGet("google")]
    [EnableRateLimiting("accounts")]
    public IActionResult Google([FromQuery] string? returnTo)
    {
        if (!AuthEndpoints.GoogleEnabled(config)) throw new ApiFault("provider_unavailable", "Google sign-in is not configured yet.");
        return Challenge(new AuthenticationProperties { RedirectUri = "/login?google=complete&returnTo=" + Uri.EscapeDataString(AuthEndpoints.SafeReturn(returnTo)) }, GoogleDefaults.AuthenticationScheme);
    }
}
