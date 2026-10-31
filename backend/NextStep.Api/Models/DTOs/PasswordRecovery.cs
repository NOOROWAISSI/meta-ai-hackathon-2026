namespace NextStep.Api;

public sealed record RequestPasswordCode(string Email, string Language = "en");
public sealed record VerifyPasswordCode(string ChallengeId, string Code);
public sealed record ResetPassword(string ChallengeId, string ResetToken, string Password);
public sealed record PasswordChallenge(string ChallengeId, int ExpiresInSeconds = 600, int ResendAfterSeconds = 60);
