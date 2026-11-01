using System.Text.Json;
using System.Text.Json.Nodes;
using MySqlConnector;
using NextStep.MetaAi;

namespace NextStep.Api;

// Companion provenance records; canonical StudentProfile remains the planning contract.
public sealed record SourceChunk(string Id, string Locator, string Text);
public sealed record ProfessionalSource(string Id, string Kind, string Title, string? Url, string? Revision, string ImportedAt, SourceChunk[] Chunks, string[] Warnings);
public sealed record SourceReference(string SourceId, string ChunkId, string Quote);
public sealed record ProposedFact(string Kind, string Value, string Basis, string Explanation, SourceReference[] References);
public sealed record ExtractionOutput(ProposedFact[] Facts, string[] Questions);
public sealed record EvidenceDraft(string Id, int ProfileVersion, int SourcesVersion, ExtractionOutput Output);
public sealed record ConfirmedFact(string Id, string Kind, string Value, string Contribution, SourceReference[] References, string ConfirmedAt);
public sealed class EvidenceWorkspace {
    public int SchemaVersion { get; set; } = 1;
    public int Version { get; set; }
    public List<ProfessionalSource> Sources { get; set; } = [];
    public EvidenceDraft? Draft { get; set; }
    public List<ConfirmedFact> Confirmed { get; set; } = [];
    public string? AcceptedDraftId { get; set; }
    public string? AcceptedFingerprint { get; set; }
    public Dictionary<string, InsightView> Comparisons { get; set; } = [];
}
public sealed record EvidenceView(int ProfileVersion, EvidenceWorkspace Workspace, ConfirmedFact[]? CurrentFacts = null);
public sealed record EvidenceAnalysisRequest(int ProfileVersion, int SourcesVersion, string[] SourceIds, bool Consent, string Language);
public sealed record FactAcceptance(int Index, string Value, string Contribution);
public sealed record EvidenceAcceptance(string DraftId, int ProfileVersion, int SourcesVersion, FactAcceptance[] Facts);
public sealed record InsightSection(string Title, string Explanation, string[] EvidenceIds);
public sealed record OpportunityInsight(string Summary, InsightSection[] Connections, InsightSection[] Gaps, string[] Questions, string[] PreparationPriorities);
public sealed record InsightRequest(int ProfileVersion, int SourcesVersion, bool Consent, string Language);
public sealed record InsightView(int ProfileVersion, int SourcesVersion, string SourceRevision, OpportunityInsight Analysis, string Language = "en", string? GeneratedAt = null, bool Outdated = false);
public interface IEvidenceIntelligence {
    Task<ExtractionOutput> Extract(ProfessionalSource[] sources, string language, CancellationToken ct);
    Task<OpportunityInsight> Compare(JsonObject context, string language, CancellationToken ct);
}

public sealed class EvidenceRepository(MySqlStateStore store) {
    public async Task<T> Read<T>(string owner, Func<UserState, EvidenceWorkspace, T> action, CancellationToken ct) {
        await using var connection = await store.Open(ct);
        await using var command = new MySqlCommand("SELECT s.payload,e.payload FROM user_state s LEFT JOIN profile_evidence e ON e.owner_id=s.owner_id WHERE s.owner_id=@owner", connection);
        command.Parameters.AddWithValue("@owner", owner);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new ApiFault("not_found", "Account data is unavailable.");
        var state = JsonSerializer.Deserialize<UserState>(reader.GetString(0), Wire.Json)!;
        var json = reader.IsDBNull(1) ? null : reader.GetString(1);
        var evidence = json is null ? new EvidenceWorkspace() : JsonSerializer.Deserialize<EvidenceWorkspace>(json, Wire.Json)!;
        Input.Require(state.SchemaVersion == 1 && evidence.SchemaVersion == 1, "Stored data requires recovery; no changes were made.");
        return action(state, evidence);
    }

    public async Task<T> Transaction<T>(string owner, Func<UserState, EvidenceWorkspace, T> action, CancellationToken ct) {
        await using var connection = await store.Open(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        await using var stateCommand = new MySqlCommand("SELECT payload FROM user_state WHERE owner_id=@owner FOR UPDATE", connection, tx);
        stateCommand.Parameters.AddWithValue("@owner", owner);
        var stateJson = await stateCommand.ExecuteScalarAsync(ct) as string ?? throw new ApiFault("not_found", "Account data is unavailable.");
        var state = JsonSerializer.Deserialize<UserState>(stateJson, Wire.Json)!;
        await using var evidenceCommand = new MySqlCommand("SELECT payload FROM profile_evidence WHERE owner_id=@owner", connection, tx);
        evidenceCommand.Parameters.AddWithValue("@owner", owner);
        var json = await evidenceCommand.ExecuteScalarAsync(ct) as string;
        var evidence = json is null ? new EvidenceWorkspace() : JsonSerializer.Deserialize<EvidenceWorkspace>(json, Wire.Json)!;
        Input.Require(state.SchemaVersion == 1 && evidence.SchemaVersion == 1, "Stored data requires recovery; no changes were made.");
        var result = action(state, evidence);
        var updatedState = JsonSerializer.Serialize(state, Wire.Json);
        var updatedEvidence = JsonSerializer.Serialize(evidence, Wire.Json);
        Input.Require(System.Text.Encoding.UTF8.GetByteCount(updatedState) <= 1048576 && System.Text.Encoding.UTF8.GetByteCount(updatedEvidence) <= 2097152, "Stored information is too large. Remove an old source before retrying.");
        await using var update = new MySqlCommand("UPDATE user_state SET payload=@state,revision=revision+1 WHERE owner_id=@owner; INSERT INTO profile_evidence(owner_id,payload) VALUES(@owner,@evidence) ON DUPLICATE KEY UPDATE payload=@evidence", connection, tx);
        update.Parameters.AddWithValue("@owner", owner); update.Parameters.AddWithValue("@state", updatedState); update.Parameters.AddWithValue("@evidence", updatedEvidence);
        await update.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct);
        return result;
    }
}

public sealed class ProfileEvidenceService(EvidenceRepository repository, IEvidenceIntelligence intelligence, DiscoveryFeed feed, Catalog catalog) {
    private static ConfirmedFact[] CurrentFacts(StudentProfile profile, EvidenceWorkspace workspace) {
        var adopted = workspace.Confirmed.Where(f => f.Kind switch {
            "skill" => profile.Skills.Any(x => x.Label == f.Value && x.State == "reported_has"),
            "project" => profile.ProjectExperience.Any(x => x.Id == f.Id && x.Description == f.Value + "\nPersonal contribution: " + f.Contribution),
            "goal" => profile.Goals.Any(x => x.Id == f.Id && x.Statement == f.Value),
            _ => profile.Background.Contains(f.Value, StringComparison.Ordinal)
        }).ToList();
        foreach (var skill in profile.Skills.Where(x => x.State == "reported_has" && !adopted.Any(f => f.Kind == "skill" && f.Value == x.Label))) adopted.Add(new("profile-skill-" + skill.Id, "skill", skill.Label, "", [], ""));
        foreach (var project in profile.ProjectExperience.Where(x => !adopted.Any(f => f.Id == x.Id))) adopted.Add(new("profile-project-" + project.Id, "project", project.Description, "Student-entered project description; clarify personal contribution if unclear.", [], ""));
        foreach (var goal in profile.Goals.Where(x => !adopted.Any(f => f.Id == x.Id))) adopted.Add(new("profile-goal-" + goal.Id, "goal", goal.Statement, "", [], ""));
        if (!string.IsNullOrWhiteSpace(profile.Background)) adopted.Add(new("profile-background", "experience", ProfessionalDocuments.Clean(profile.Background), "", [], ""));
        return adopted.ToArray();
    }
    public Task<EvidenceView> Read(string owner, CancellationToken ct) => repository.Read(owner, (s, e) => new EvidenceView(s.Profile.Version, e, CurrentFacts(s.Profile, e)), ct);
    private static void Current(UserState state, EvidenceWorkspace evidence, int profile, int sources) {
        if (state.Profile.Version != profile || evidence.Version != sources) throw new ApiFault("version_conflict", "Your profile or sources changed. Refresh before continuing; existing progress is preserved.");
    }
    public Task<EvidenceView> Add(string owner, ProfessionalSource source, int profile, int version, CancellationToken ct) => repository.Transaction(owner, (s, e) => {
        Current(s, e, profile, version);
        Input.Require(e.Sources.Count < 12, "Keep at most 12 sources. Remove one before adding another.");
        e.Sources.Add(source); e.Version++; e.Draft = null;
        s.Profile = s.Profile with { Version = checked(s.Profile.Version + 1) };
        return new EvidenceView(s.Profile.Version, e);
    }, ct);
    public Task<EvidenceView> Delete(string owner, string id, int profile, int version, CancellationToken ct) => repository.Transaction(owner, (s, e) => {
        Current(s, e, profile, version);
        Input.Require(e.Sources.RemoveAll(x => x.Id == id) == 1, "That source is unavailable.");
        e.Draft = null; e.Version++;
        // Adopted facts remain student-confirmed profile information; remove retained private quotations.
        e.Confirmed = e.Confirmed.Select(f => f with { References = f.References.Where(r => r.SourceId != id).ToArray() }).ToList();
        s.Profile = s.Profile with { Version = checked(s.Profile.Version + 1) };
        return new EvidenceView(s.Profile.Version, e);
    }, ct);
    public static void Validate(ExtractionOutput output, ProfessionalSource[] sources) {
        Input.Require(output.Facts is { Length: <= 24 } && output.Questions is { Length: <= 8 }, "The extraction returned an invalid number of facts.");
        foreach (var fact in output.Facts) {
            Input.Require(fact.Kind is "skill" or "project" or "experience" or "goal" && fact.Basis is "source_statement" or "artifact_observation" or "inference" && fact.Value is { Length: > 0 and <= 1500 } && fact.Explanation is { Length: <= 1000 } && fact.References is { Length: > 0 and <= 4 }, "An extracted fact is invalid.");
            foreach (var reference in fact.References) {
                var chunk = sources.SingleOrDefault(s => s.Id == reference.SourceId)?.Chunks.SingleOrDefault(c => c.Id == reference.ChunkId);
                Input.Require(reference.Quote is { Length: >= 8 and <= 500 } && chunk is not null && chunk.Text.Contains(reference.Quote, StringComparison.Ordinal), "An extracted fact cited a passage that is absent from the selected sources.");
            }
        }
        Input.Require(output.Questions.All(q => q is { Length: > 0 and <= 600 }), "A clarification question is invalid.");
    }
    public async Task<EvidenceView> Analyze(string owner, EvidenceAnalysisRequest request, CancellationToken ct) {
        Input.Require(request.Consent && request.Language is "en" or "ar" && request.SourceIds is { Length: > 0 and <= 3 } && request.SourceIds.Distinct().Count() == request.SourceIds.Length, "Select one to three sources and consent to analysis.");
        var sources = await repository.Read(owner, (s, e) => {
            Current(s, e, request.ProfileVersion, request.SourcesVersion);
            var selected = request.SourceIds.Select(id => e.Sources.SingleOrDefault(x => x.Id == id) ?? throw new ApiFault("not_found", "A selected source is unavailable.")).ToArray();
            Input.Require(selected.Sum(x => x.Chunks.Sum(c => c.Text.Length)) <= 60000, "Select fewer sources for this analysis (maximum 60,000 characters).");
            return selected;
        }, ct);
        var output = await intelligence.Extract(sources, request.Language, ct);
        Validate(output, sources);
        return await repository.Transaction(owner, (s, e) => {
            Current(s, e, request.ProfileVersion, request.SourcesVersion);
            e.Draft = new(Guid.NewGuid().ToString("N"), s.Profile.Version, e.Version, output);
            return new EvidenceView(s.Profile.Version, e);
        }, ct);
    }
    public Task<EvidenceView> Accept(string owner, EvidenceAcceptance request, CancellationToken ct) => repository.Transaction(owner, (s, e) => {
        var fingerprint = MySqlStateStore.Hash(JsonSerializer.Serialize(request, Wire.Json));
        if (e.AcceptedDraftId == request.DraftId) {
            if (e.AcceptedFingerprint != fingerprint) throw new ApiFault("version_conflict", "This draft was already accepted with different facts. Reload your confirmed profile.");
            return new EvidenceView(s.Profile.Version, e);
        }
        Current(s, e, request.ProfileVersion, request.SourcesVersion);
        var draft = e.Draft;
        Input.Require(draft is not null && draft.Id == request.DraftId && draft.ProfileVersion == s.Profile.Version && draft.SourcesVersion == e.Version, "This extraction is outdated. Analyze current sources again.");
        Input.Require(request.Facts is { Length: > 0 and <= 24 } && request.Facts.Select(f => f.Index).Distinct().Count() == request.Facts.Length, "Choose the facts you want to confirm.");
        var profile = s.Profile;
        foreach (var accepted in request.Facts) {
            Input.Require(accepted.Index >= 0 && accepted.Index < draft!.Output.Facts.Length && accepted.Value is { Length: > 0 and <= 1500 } && accepted.Contribution is { Length: <= 1500 }, "A confirmed fact is invalid.");
            var proposed = draft!.Output.Facts[accepted.Index];
            var id = "evidence-" + Guid.NewGuid().ToString("N");
            if (proposed.Kind == "skill") {
                Input.Require(accepted.Value.Length <= 100, "Keep skill names under 100 characters.");
                var existing = profile.Skills.FirstOrDefault(x => x.Label.Equals(accepted.Value, StringComparison.OrdinalIgnoreCase));
                profile = existing is null
                    ? profile with { Skills = [..profile.Skills, new(id, accepted.Value, "reported_has")] }
                    : profile with { Skills = profile.Skills.Select(skill => skill.Id == existing.Id ? skill with { Label = accepted.Value, State = "reported_has" } : skill).ToArray() };
            } else if (proposed.Kind == "project") {
                Input.Require(!string.IsNullOrWhiteSpace(accepted.Contribution), "Describe your personal contribution before adopting a project.");
                profile = profile with { ProjectExperience = [..profile.ProjectExperience, new(id, accepted.Value + "\nPersonal contribution: " + accepted.Contribution)] };
                var projects = s.ProfileEditor["projects"] as JsonArray ?? new JsonArray();
                if (projects.Parent is null) s.ProfileEditor["projects"] = projects;
                projects.Add(new JsonObject { ["id"] = id, ["title"] = accepted.Value.Split('\n')[0][..Math.Min(100, accepted.Value.Split('\n')[0].Length)], ["description"] = accepted.Value, ["contribution"] = accepted.Contribution, ["technologies"] = new JsonArray(), ["url"] = "" });
            } else if (proposed.Kind == "goal") profile = profile with { Goals = [..profile.Goals, new(id, accepted.Value)] };
            else profile = profile with { Background = (profile.Background + "\n" + accepted.Value).Trim() };
            e.Confirmed.Add(new(id, proposed.Kind, accepted.Value, accepted.Contribution, proposed.References, DateTimeOffset.UtcNow.ToString("O")));
        }
        Input.Require(e.Confirmed.Count <= 100, "The confirmed-fact limit has been reached.");
        profile = profile with { Version = checked(profile.Version + 1) }; Input.Profile(profile);
        ProfileEditorValidation.Validate(s.ProfileEditor);
        s.Profile = profile; e.AcceptedDraftId = draft!.Id; e.AcceptedFingerprint = fingerprint; e.Draft = null;
        return new EvidenceView(profile.Version, e);
    }, ct);
    public async Task<InsightView?> SavedComparison(string owner, string id, string language, CancellationToken ct) {
        Input.Require(language is "en" or "ar", "Choose English or Arabic.");
        var listing = (await feed.Listings(ct)).SingleOrDefault(x => x.Id == id) ?? throw new ApiFault("not_found", "The opportunity is unavailable.");
        var record = catalog.All().SingleOrDefault(x => x.Id == id);
        var revision = MySqlStateStore.Hash(JsonSerializer.Serialize(new { listing, record }, Wire.Json));
        return await repository.Read(owner, (s, e) => e.Comparisons.TryGetValue(id + ":" + language, out var saved)
            ? saved with { Outdated = saved.ProfileVersion != s.Profile.Version || saved.SourcesVersion != e.Version || saved.SourceRevision != revision }
            : null, ct);
    }
    public async Task<InsightView> Compare(string owner, string id, InsightRequest request, CancellationToken ct) {
        Input.Require(request.Consent && request.Language is "en" or "ar", "Confirm that Meta may analyze your confirmed profile information.");
        var listing = (await feed.Listings(ct)).SingleOrDefault(x => x.Id == id) ?? throw new ApiFault("not_found", "The opportunity is unavailable.");
        var record = catalog.All().SingleOrDefault(x => x.Id == id);
        var revision = MySqlStateStore.Hash(JsonSerializer.Serialize(new { listing, record }, Wire.Json));
        var snapshot = await repository.Read(owner, (s, e) => {
            Current(s, e, request.ProfileVersion, request.SourcesVersion);
            return new {
                facts = CurrentFacts(s.Profile, e).Select(f => new { f.Id, f.Kind, Value = ProfessionalDocuments.Clean(f.Value), Contribution = ProfessionalDocuments.Clean(f.Contribution) }).ToArray(),
                availability = s.Profile.AvailableHoursPerWeek,
                goals = s.Profile.Goals.Select(goal => new { goal.Id, Statement = ProfessionalDocuments.Clean(goal.Statement) }).ToArray(),
                constraints = s.Profile.Constraints.Select(ProfessionalDocuments.Clean).ToArray(),
                preferredFormats = s.Profile.PreferredFormats
            };
        }, ct);
        var facts = JsonSerializer.SerializeToNode(new { confirmed = snapshot.facts, snapshot.availability, snapshot.goals, snapshot.constraints, snapshot.preferredFormats, listing, opportunity = record }, Wire.Json)!.AsObject();
        var analysis = await intelligence.Compare(facts, request.Language, ct);
        Input.Require(analysis.Summary is { Length: > 0 and <= 3000 } && analysis.Connections is { Length: <= 6 } && analysis.Gaps is { Length: <= 6 } && analysis.Questions is { Length: <= 8 } && analysis.PreparationPriorities is { Length: <= 8 }, "The comparison returned an invalid structure.");
        var ids = snapshot.facts.Select(f => f.Id).ToHashSet();
        foreach (var section in analysis.Connections.Concat(analysis.Gaps)) Input.Require(section.Title is { Length: > 0 and <= 150 } && section.Explanation is { Length: > 0 and <= 2000 } && section.EvidenceIds is { Length: <= 8 } && section.EvidenceIds.All(ids.Contains), "The comparison referenced information outside your confirmed evidence.");
        Input.Require(analysis.Connections.All(x => x.EvidenceIds.Length > 0) && analysis.Questions.Concat(analysis.PreparationPriorities).All(x => x is { Length: > 0 and <= 1500 }), "A personal connection requires confirmed evidence.");
        var latest = (await feed.Listings(ct)).SingleOrDefault(x => x.Id == id);
        if (revision != MySqlStateStore.Hash(JsonSerializer.Serialize(new { listing = latest, record = catalog.All().SingleOrDefault(x => x.Id == id) }, Wire.Json))) throw new ApiFault("version_conflict", "The opportunity changed during analysis. Request a fresh comparison.");
        return await repository.Transaction(owner, (s, e) => {
            Current(s, e, request.ProfileVersion, request.SourcesVersion);
            var result = new InsightView(request.ProfileVersion, request.SourcesVersion, revision, analysis, request.Language, DateTimeOffset.UtcNow.ToString("O"));
            e.Comparisons[id + ":" + request.Language] = result;
            if (e.Comparisons.Count > 12) e.Comparisons.Remove(e.Comparisons.OrderBy(pair => pair.Value.GeneratedAt).First().Key);
            return result;
        }, ct);
    }
}
