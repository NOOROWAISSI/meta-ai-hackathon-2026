using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace NextStep.Api;

public static partial class ProfessionalDocuments {
    public const int MaxBytes = 5 * 1024 * 1024;
    public static string Clean(string text) {
        text = Regex.Replace(text, @"(?im)^.*(?:date of birth|nationality|passport|national id|religion|تاريخ الميلاد|الجنسية|رقم الهوية).*$", "[Identity detail omitted]");
        text = Regex.Replace(text, @"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[Email omitted]");
        text = Regex.Replace(text, @"(?<!\w)\+?\d[\d ()-]{8,}\d(?!\w)", "[Contact number omitted]");
        text = Regex.Replace(text, @"(?im)^.*(?:api[_-]?key|access[_-]?token|password|BEGIN .*PRIVATE KEY).*$", "[Potential secret omitted]");
        return text.Replace("\0", "").Trim();
    }
    public static ProfessionalSource Text(string kind, string title, string text, string? url = null) {
        Input.Require(kind is "cv" or "linkedin" && title is { Length: > 0 and <= 150 } && text is { Length: > 0 and <= 60000 }, "Provide up to 60,000 characters of professional information.");
        if (!string.IsNullOrWhiteSpace(url)) Input.Require(Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.Host is "linkedin.com" or "www.linkedin.com" && uri.AbsolutePath.StartsWith("/in/", StringComparison.Ordinal), "Use a public linkedin.com/in/ profile URL as provenance, or leave it blank.");
        return Build(kind, title, url, null, [new("text", "Provided professional text", Clean(text))]);
    }
    public static ProfessionalSource Parse(string name, byte[] bytes, string kind) {
        Input.Require(kind is "cv" or "linkedin" && bytes.Length is > 0 and <= MaxBytes, "Upload a PDF or DOCX up to 5 MB.");
        var chunks = new List<SourceChunk>();
        try {
            if (Path.GetExtension(name).Equals(".pdf", StringComparison.OrdinalIgnoreCase) && bytes.AsSpan().StartsWith("%PDF-"u8)) {
                using var pdf = PdfDocument.Open(bytes);
                Input.Require(pdf.NumberOfPages <= 30, "Use a document with at most 30 pages.");
                foreach (var page in pdf.GetPages()) chunks.Add(new("page-" + page.Number, "Page " + page.Number, Clean(ContentOrderTextExtractor.GetText(page))));
            } else if (Path.GetExtension(name).Equals(".docx", StringComparison.OrdinalIgnoreCase) && bytes.AsSpan().StartsWith("PK"u8)) {
                using var zip = new ZipArchive(new MemoryStream(bytes));
                Input.Require(zip.Entries.Count <= 300 && zip.Entries.Sum(e => e.Length) <= 20 * 1024 * 1024 && !zip.Entries.Any(e => e.FullName.EndsWith("vbaProject.bin", StringComparison.OrdinalIgnoreCase)), "This DOCX archive exceeds the safe document limits.");
                var document = zip.GetEntry("word/document.xml") ?? throw new ApiFault("invalid_input", "This is not a Word DOCX document.");
                Input.Require(document.Length <= 2 * 1024 * 1024, "The document text is too large.");
                using var stream = document.Open();
                using var reader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 2 * 1024 * 1024 });
                var xml = XDocument.Load(reader); XNamespace word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
                var paragraphs = xml.Descendants(word + "p").Select(p => string.Concat(p.Descendants(word + "t").Select(x => x.Value))).Where(x => !string.IsNullOrWhiteSpace(x)).ToArray();
                for (var i = 0; i < paragraphs.Length; i++) chunks.Add(new("paragraph-" + (i + 1), "Paragraph " + (i + 1), Clean(paragraphs[i])));
            } else throw new ApiFault("invalid_input", "The file contents must match a PDF or DOCX extension.");
        } catch (ApiFault) { throw; }
          catch (Exception error) when (error is not OperationCanceledException and not OutOfMemoryException) { throw new ApiFault("invalid_input", "This document could not be read. Try an unencrypted text PDF, DOCX, or paste the professional text."); }
        return Build(kind, Path.GetFileName(name)[..Math.Min(150, Path.GetFileName(name).Length)], null, null, chunks.ToArray());
    }
    public static ProfessionalSource Build(string kind, string title, string? url, string? revision, SourceChunk[] chunks) {
        chunks = chunks.Where(x => !string.IsNullOrWhiteSpace(x.Text)).ToArray();
        Input.Require(chunks.Length > 0 && chunks.Sum(x => x.Text.Length) is >= 20 and <= 60000, "No readable professional text was found, or it exceeds 60,000 characters. Scanned PDFs need a text version; you can paste the text instead.");
        return new(Guid.NewGuid().ToString("N"), kind, title, url, revision, DateTimeOffset.UtcNow.ToString("O"), chunks, ["Private extracted text only; original upload discarded. Review the preview for sensitive details before consenting to Meta analysis.", kind == "github" ? "A selected code sample, not a full audit. Repository ownership and code do not establish personal authorship or competence." : "Statements in this document are self-reported, not independently verified."]);
    }
}

public sealed record PublicRepository(string Name, string Url, string Description);
public sealed class PublicGitHubSources(HttpClient http) {
    private async Task<JsonDocument> Get(string path, CancellationToken ct) {
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/" + path);
        request.Headers.UserAgent.ParseAdd("NextStep-Professional-Profile/1.0");
        request.Headers.Accept.ParseAdd("application/vnd.github+json");
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode) throw new ApiFault("provider_unavailable", "GitHub could not return this public repository. Check the URL or retry after its rate limit resets.", true);
        await using var stream = await response.Content.ReadAsStreamAsync(ct); using var output = new MemoryStream(); var buffer = new byte[4096]; int read;
        while ((read = await stream.ReadAsync(buffer, ct)) > 0) { Input.Require(output.Length + read <= 2097152, "The GitHub response exceeds the import limit."); output.Write(buffer, 0, read); }
        return JsonDocument.Parse(output.ToArray());
    }
    public static bool ValidName(string value) => value is { Length: > 0 and <= 100 } && value.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '.');
    public async Task<PublicRepository[]> Repositories(string account, CancellationToken ct) {
        Input.Require(ValidName(account), "Enter a GitHub username.");
        using var result = await Get($"users/{Uri.EscapeDataString(account)}/repos?type=owner&sort=updated&per_page=30", ct);
        return result.RootElement.EnumerateArray().Where(r => !r.GetProperty("private").GetBoolean()).Select(r => new PublicRepository(r.GetProperty("full_name").GetString()!, r.GetProperty("html_url").GetString()!, r.GetProperty("description").GetString() ?? "")).ToArray();
    }
    public async Task<ProfessionalSource> Import(string url, CancellationToken ct) {
        Input.Require(Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.Host == "github.com" && uri.IsDefaultPort && string.IsNullOrEmpty(uri.UserInfo) && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment), "Use a public https://github.com/owner/repository URL.");
        var parts = uri!.AbsolutePath.Trim('/').Split('/');
        Input.Require(parts.Length == 2 && parts.All(ValidName), "Select one public GitHub repository.");
        var path = "repos/" + string.Join('/', parts.Select(Uri.EscapeDataString));
        using var repo = await Get(path, ct);
        Input.Require(!repo.RootElement.GetProperty("private").GetBoolean(), "Only selected public repositories are supported.");
        var branch = repo.RootElement.GetProperty("default_branch").GetString()!;
        using var commit = await Get(path + "/commits/" + Uri.EscapeDataString(branch), ct);
        var sha = commit.RootElement.GetProperty("sha").GetString()!;
        using var tree = await Get(path + "/git/trees/" + sha + "?recursive=1", ct);
        var entries = tree.RootElement.GetProperty("tree").EnumerateArray().Where(e => e.GetProperty("type").GetString() == "blob" && e.GetProperty("mode").GetString() is "100644" or "100755").Where(e => Suitable(e.GetProperty("path").GetString()!) && e.GetProperty("size").GetInt64() <= 100000).OrderBy(e => e.GetProperty("path").GetString()!.Contains("readme", StringComparison.OrdinalIgnoreCase) ? 0 : 1).Take(10).ToArray();
        var chunks = new List<SourceChunk>();
        foreach (var entry in entries) {
            using var blob = await Get(path + "/git/blobs/" + entry.GetProperty("sha").GetString(), ct);
            Input.Require(blob.RootElement.GetProperty("encoding").GetString() == "base64", "The source encoding is unsupported.");
            var text = ProfessionalDocuments.Clean(Encoding.UTF8.GetString(Convert.FromBase64String(blob.RootElement.GetProperty("content").GetString()!)));
            if (text.Length > 4500) text = text[..4500] + "\n[Excerpt ends]";
            chunks.Add(new("file-" + chunks.Count, entry.GetProperty("path").GetString()!, text));
        }
        return ProfessionalDocuments.Build("github", string.Join('/', parts), "https://github.com/" + string.Join('/', parts), sha, chunks.ToArray());
    }
    public static bool Suitable(string path) {
        var lower = path.ToLowerInvariant();
        if (lower.Split('/').Any(p => p.StartsWith('.') || p is "node_modules" or "vendor" or "bin" or "obj" or "dist" or "build") || lower.Contains("secret") || lower.Contains("credential") || lower.Contains("lock") || lower.Contains(".min.")) return false;
        return lower.EndsWith(".md") || new[] { ".ts", ".tsx", ".js", ".jsx", ".py", ".cs", ".java", ".cpp", ".go", ".rs", ".ipynb" }.Any(lower.EndsWith);
    }
}
