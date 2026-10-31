using System.Net;
using System.Net.Http.Json;

// Test-only transport. No Google API call, real account, credential or token is used.
public sealed class FakeGoogleBackchannel : HttpMessageHandler
{
    public string Subject { get; } = "synthetic-subject-" + Guid.NewGuid().ToString("N");
    public string Email { get; set; } = "google-check-" + Guid.NewGuid().ToString("N") + "@example.invalid";
    public bool Verified { get; set; } = true;
    public int Calls { get; private set; }
    public bool ExchangeHadVerifier { get; private set; }
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        if (request.RequestUri?.Host == "oauth2.googleapis.com" && request.RequestUri.AbsolutePath == "/token") {
            ExchangeHadVerifier = (await request.Content!.ReadAsStringAsync(cancellationToken)).Contains("code_verifier=");
            return new(HttpStatusCode.OK) { Content = JsonContent.Create(new { access_token = "synthetic-access-token", token_type = "Bearer", expires_in = 3600 }) };
        }
        if (request.RequestUri?.Host == "www.googleapis.com" && request.RequestUri.AbsolutePath.EndsWith("/userinfo", StringComparison.Ordinal)) return new(HttpStatusCode.OK) { Content = JsonContent.Create(new { id = Subject, email = Email, name = "Synthetic Google student", verified_email = Verified }) };
        throw new InvalidOperationException("Unexpected OAuth test request. Real network access is disabled by this handler.");
    }
}
