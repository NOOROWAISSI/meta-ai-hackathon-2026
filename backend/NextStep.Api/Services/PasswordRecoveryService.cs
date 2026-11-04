using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;

namespace NextStep.Api;

public sealed class PasswordRecoveryService(PasswordRecoveryRepository repository, IEmailSender mail, IConfiguration config)
{
    public bool Configured => mail.Configured && config["Authentication:RecoveryPepper"] is { Length: >= 32 };
    private string Hash(string value) => Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(config["Authentication:RecoveryPepper"]!), Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    public async Task<PasswordChallenge> Request(RequestPasswordCode input, CancellationToken ct)
    {
        var email = input.Email?.Trim() ?? "";
        Input.Require(email.Length <= 254 && MailAddress.TryCreate(email, out var address) && address.Address == email && input.Language is "ar" or "en", "Enter a valid email address.");
        if (!Configured) throw new ApiFault("provider_unavailable", "Password recovery email is not configured yet. Please try later.");
        var id = Guid.NewGuid().ToString("N"); var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString(System.Globalization.CultureInfo.InvariantCulture);
        var normalized = email.ToUpperInvariant();
        var result = await repository.Reserve(Hash(normalized), normalized, id, Hash(id + ":" + code), ct);
        if (result.Throttled) throw new ApiFault("rate_limited", "Please wait one minute before requesting another code.", true);
        if (result.Send) {
            try { await mail.SendPasswordCode(email, code, input.Language, ct); await repository.Delivery(id, true, ct); }
            catch { await repository.Delivery(id, false, CancellationToken.None); throw; }
        }
        // Identical response for unknown emails and Google-only accounts. No code/token is returned.
        return new(result.Id);
    }
    public async Task<string> Verify(VerifyPasswordCode input, CancellationToken ct)
    {
        Input.Require(input.ChallengeId is { Length: 32 } && input.Code is { Length: 6 } && input.Code.All(char.IsAsciiDigit), "Enter the six-digit code.");
        if (!Configured) throw new ApiFault("provider_unavailable", "Password recovery is unavailable.");
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        if (!await repository.Verify(input.ChallengeId, Hash(input.ChallengeId + ":" + input.Code), Hash(token), ct)) throw new ApiFault("invalid_input", "The code is invalid or expired. Request a new code if needed.");
        return token;
    }
    public async Task Reset(ResetPassword input, CancellationToken ct)
    {
        Input.Require(input.ChallengeId is { Length: 32 } && input.ResetToken is { Length: 64 } && input.Password is { Length: >= 12 and <= 128 }, "Use a password between 12 and 128 characters.");
        if (!Configured) throw new ApiFault("provider_unavailable", "Password recovery is unavailable.");
        if (!await repository.Reset(input.ChallengeId, Hash(input.ResetToken), id => new PasswordHasher<string>().HashPassword(id, input.Password), ct)) throw new ApiFault("invalid_input", "The reset session expired. Request a new code.");
    }
}
