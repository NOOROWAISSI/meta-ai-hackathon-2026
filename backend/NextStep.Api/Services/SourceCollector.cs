using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using MySqlConnector;

namespace NextStep.Api;

/// <summary>Bounded, allowlisted public-page intake. It discovers candidate links,
/// never publishes organizer rules or bypasses social-platform authentication.</summary>
public sealed class SourceCollector(DiscoveryCatalog catalog, MySqlStateStore store)
{
    private static readonly Regex Links = new("<a\\b[^>]*href\\s*=\\s*[\"'](?<url>[^\"']+)[\"'][^>]*>(?<text>.*?)</a>", RegexOptions.IgnoreCase | RegexOptions.Singleline, TimeSpan.FromSeconds(1));
    private static readonly Regex Tags = new("<[^>]+>", RegexOptions.Singleline, TimeSpan.FromSeconds(1));
    private static readonly Regex Interesting = new("course|training|workshop|hackathon|competition|event|دورة|تدريب|ورشة|مسابقة", RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1));
    public async Task Collect(CancellationToken ct)
    {
        using var handler = new HttpClientHandler { AllowAutoRedirect = false, AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(12) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("NextStep-SourceReview/0.1");
        foreach (var source in catalog.Sources()) {
            var links = new List<(string Url, string Title)>(); var state = "manual_review_required"; string? hash = null;
            if (source.Collection == "public_html") try {
                var address = new Uri(source.Url);
                using var response = await client.GetAsync(address, HttpCompletionOption.ResponseHeadersRead, ct);
                state = "http_" + (int)response.StatusCode;
                if (response.IsSuccessStatusCode && response.Content.Headers.ContentType?.MediaType is "text/html" or "application/xhtml+xml") {
                    await using var body = await response.Content.ReadAsStreamAsync(ct); using var buffer = new MemoryStream();
                    var chunk = new byte[8192]; int read;
                    while ((read = await body.ReadAsync(chunk, ct)) > 0) { if (buffer.Length + read > 524288) throw new InvalidDataException("Page exceeds review limit"); buffer.Write(chunk, 0, read); }
                    var text = Encoding.UTF8.GetString(buffer.ToArray()); hash = MySqlStateStore.Hash(text);
                    foreach (Match match in Links.Matches(text)) {
                        var label = WebUtility.HtmlDecode(Tags.Replace(match.Groups["text"].Value, " ")).Trim();
                        if (label.Length < 4 || !Interesting.IsMatch(label + " " + match.Groups["url"].Value) || !Uri.TryCreate(address, WebUtility.HtmlDecode(match.Groups["url"].Value), out var target) || target.Scheme != "https" || !string.Equals(target.Host, address.Host, StringComparison.OrdinalIgnoreCase) || !string.IsNullOrEmpty(target.UserInfo)) continue;
                        var canonical = new UriBuilder(target) { Fragment = "", Query = "" }.Uri.AbsoluteUri;
                        if (canonical.Length > 2000 || links.Any(link => link.Url == canonical)) continue;
                        links.Add((canonical, label.Length <= 300 ? label : label[..300])); if (links.Count == 100) break;
                    }
                    state = "captured_for_review";
                }
            } catch (OperationCanceledException) when (!ct.IsCancellationRequested) { state = "timeout"; }
              catch (HttpRequestException) { state = "source_unavailable"; }
              catch (InvalidDataException) { state = "page_too_large"; }
              catch (RegexMatchTimeoutException) { state = "parse_limit"; }
            await Save(source.Id, links, state, hash, ct);
            Console.WriteLine($"{source.Id}: {state}; {links.Count} candidate links, none automatically published");
            await Task.Delay(300, ct);
        }
    }
    internal async Task Save(string id, List<(string Url, string Title)> links, string state, string? hash, CancellationToken ct)
    {
        await using var db = await store.Open(ct); await using var tx = await db.BeginTransactionAsync(ct); var now = DateTime.UtcNow;
        await using var run = new MySqlCommand("INSERT INTO source_runs(source_id,checked_at,result,candidate_count,content_hash) VALUES(@id,@now,@state,@count,@hash) ON DUPLICATE KEY UPDATE checked_at=@now,result=@state,candidate_count=@count,content_hash=@hash", db, tx);
        run.Parameters.AddWithValue("@id", id); run.Parameters.AddWithValue("@now", now); run.Parameters.AddWithValue("@state", state); run.Parameters.AddWithValue("@count", links.Count); run.Parameters.AddWithValue("@hash", (object?)hash ?? DBNull.Value); await run.ExecuteNonQueryAsync(ct);
        foreach (var link in links) {
            await using var insert = new MySqlCommand("INSERT INTO intake_candidates(id,source_id,url,title_hint,first_seen_at,last_seen_at) VALUES(@id,@source,@url,@title,@now,@now) ON DUPLICATE KEY UPDATE last_seen_at=@now", db, tx);
            insert.Parameters.AddWithValue("@id", MySqlStateStore.Hash(link.Url)); insert.Parameters.AddWithValue("@source", id); insert.Parameters.AddWithValue("@url", link.Url); insert.Parameters.AddWithValue("@title", link.Title); insert.Parameters.AddWithValue("@now", now); await insert.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
    }
}
