using System.Net;
using System.Text;
using System.Text.Json;
using NextStep.Api;

public sealed class TranslationHandler : HttpMessageHandler, IHttpClientFactory
{
    public int Calls;
    public bool Verified;
    public HttpClient CreateClient(string name) => new(this, disposeHandler: false);
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Calls++;
        using var document = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
        var body = document.RootElement;
        Verified = request.RequestUri!.AbsoluteUri == "https://api.meta.ai/v1/chat/completions" && body.GetProperty("response_format").GetProperty("type").GetString() == "json_schema" && body.GetProperty("messages")[0].GetProperty("role").GetString() == "system";
        var original = JsonSerializer.Deserialize<TranslatedListing[]>(body.GetProperty("messages")[1].GetProperty("content").GetString()!, Wire.Json)!;
        var content = JsonSerializer.Serialize(new { items = original.Select(item => item with { Title = "ترجمة تجريبية", Summary = "وصف تجريبي", VerificationNote = "مراجعة تجريبية" }) }, Wire.Json);
        var response = JsonSerializer.Serialize(new { choices = new[] { new { finish_reason = "stop", message = new { content } } } });
        return new(HttpStatusCode.OK) { Content = new StringContent(response, Encoding.UTF8, "application/json") };
    }
}
