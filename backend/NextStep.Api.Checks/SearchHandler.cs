using System.Net;
using System.Text;
using System.Text.Json;

public sealed class SearchHandler : HttpMessageHandler
{
    public bool Verified;
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
        var json = body.RootElement;
        Verified = request.RequestUri!.AbsoluteUri == "https://api.meta.ai/v1/responses" &&
            request.Headers.Authorization?.Scheme == "Bearer" &&
            json.GetProperty("tools")[0].GetProperty("type").GetString() == "web_search" &&
            json.GetProperty("include")[0].GetString() == "web_search_call.results" &&
            json.GetProperty("input").GetString()!.Contains("https://www.instagram.com/ewb.nnu/");
        return new(HttpStatusCode.OK) { Content = new StringContent("""{"status":"completed","output":[{"type":"web_search_call","status":"completed","results":[{"url":"https://example.org/fixture","title":"Synthetic, never published"}]}]}""", Encoding.UTF8, "application/json") };
    }
}
