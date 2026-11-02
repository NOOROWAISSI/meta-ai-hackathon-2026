using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace NextStep.Api;

public sealed record SourcePage(string State, string? Html);
public interface IOfficialPageReader { Task<SourcePage> Read(Uri address, CancellationToken ct); }

// Server-owned source URLs and same-origin links only. No credentials, redirects or social-login bypass.
public sealed class OfficialPageReader : IOfficialPageReader, IDisposable
{
    private readonly HttpClient client = new(new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false, ConnectCallback = PublicSourceConnection.Connect, AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate, PooledConnectionLifetime = TimeSpan.FromMinutes(5) }) { Timeout = TimeSpan.FromSeconds(12) };
    public OfficialPageReader() => client.DefaultRequestHeaders.UserAgent.ParseAdd("NextStep-SourceReview/0.2");
    public async Task<SourcePage> Read(Uri address, CancellationToken ct)
    {
        if (address.Scheme != "https" || address.Port != 443 || address.IsLoopback || !string.IsNullOrEmpty(address.UserInfo)) return new("unsafe_address", null);
        try {
            using var robots = await client.GetAsync(new Uri(address, "/robots.txt"), HttpCompletionOption.ResponseHeadersRead, ct);
            if (robots.IsSuccessStatusCode) {
                var rules = await ReadBody(robots.Content, 65536, ct);
                if (!RobotsAllows(rules, address.PathAndQuery)) return new("robots_disallowed", null);
            } else if (robots.StatusCode != HttpStatusCode.NotFound) return new("robots_unavailable", null);
            using var response = await client.GetAsync(address, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode) return new("http_" + (int)response.StatusCode, null);
            if (response.Content.Headers.ContentType?.MediaType is not ("text/html" or "application/xhtml+xml")) return new("unsupported_content", null);
            // GDG embeds chapter/event data and its site configuration in the public HTML (about 730 KB).
            var limit = address.Host == "gdg.community.dev" ? 1048576 : 524288;
            return new("checked", await ReadBody(response.Content, limit, ct));
        } catch (OperationCanceledException) when (!ct.IsCancellationRequested) { return new("timeout", null); }
          catch (HttpRequestException) { return new("source_unavailable", null); }
          catch (InvalidDataException) { return new("page_too_large", null); }
    }
    private static async Task<string> ReadBody(HttpContent content, int limit, CancellationToken ct)
    {
        await using var stream = await content.ReadAsStreamAsync(ct); using var buffer = new MemoryStream();
        var chunk = new byte[8192]; int read;
        while ((read = await stream.ReadAsync(chunk, ct)) > 0) { if (buffer.Length + read > limit) throw new InvalidDataException(); buffer.Write(chunk, 0, read); }
        return Encoding.UTF8.GetString(buffer.ToArray());
    }
    public static bool RobotsAllows(string robots, string path)
    {
        var groups = new List<(List<string> Agents, List<(string Pattern, bool Allow)> Rules)>();
        var agents = new List<string>(); var rules = new List<(string, bool)>(); var hasDirectives = false;
        foreach (var raw in robots.Split('\n')) {
            var line = raw.Split('#')[0].Trim(); var split = line.IndexOf(':'); if (split < 0) continue;
            var key = line[..split].Trim().ToLowerInvariant(); var value = line[(split + 1)..].Trim();
            if (key == "user-agent") { if (hasDirectives) { groups.Add((agents, rules)); agents = []; rules = []; hasDirectives = false; } agents.Add(value.ToLowerInvariant()); }
            else if (key is "allow" or "disallow" && agents.Count > 0) { hasDirectives = true; if (value.Length > 0) rules.Add((value, key == "allow")); }
        }
        if (agents.Count > 0) groups.Add((agents, rules));
        var specific = groups.Where(g => g.Agents.Any(a => a == "nextstep-sourcereview")).ToArray();
        var selected = specific.Length > 0 ? specific : groups.Where(g => g.Agents.Contains("*")).ToArray();
        var matches = selected.SelectMany(g => g.Rules).Where(r => Regex.IsMatch(path, "^" + Regex.Escape(r.Pattern).Replace("\\*", ".*").Replace("\\$", "$"), RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100))).OrderByDescending(r => r.Pattern.Replace("*", "").TrimEnd('$').Length).ThenByDescending(r => r.Allow).ToArray();
        return matches.Length == 0 || matches[0].Allow;
    }
    public void Dispose() => client.Dispose();
}
