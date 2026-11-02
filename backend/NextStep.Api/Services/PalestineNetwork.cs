using System.Text.Json;

namespace NextStep.Api;

public sealed record PalestinianInstitution(string Id, string Name, string ArabicName, string Url, string ReferenceUrl);
public sealed record CampusOrganization(string Id, string UniversityId, string Name, string ArabicName, string Family, string Url, string ReferenceUrl, string CollectionUrl, string Channel);
public sealed record PalestineNetworkView(string ReviewedAt, string ReferenceUrl, PalestinianInstitution[] Institutions, CampusOrganization[] Organizations);
public sealed class PalestineNetwork {
    public PalestineNetworkView Read() => JsonSerializer.Deserialize<PalestineNetworkView>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Data", "palestine-network.json")), Wire.Json)!;
    public SourceRegistration[] Sources() {
        var network = Read();
        return network.Institutions.Select(u => new SourceRegistration("university-" + u.Id, u.Name, u.Url, "palestine", "official_website", "public_html", u.ReferenceUrl, "Official institution directory reference. Collection coverage and announcement availability are checked separately.") { UniversityId = u.Id, OrganizationId = "university-" + u.Id })
            .Concat(network.Organizations.Select(o => new SourceRegistration("campus-" + o.Id, o.Name, o.CollectionUrl, "palestine", o.Channel, o.Channel == "official_website" ? "public_html" : "manual_review", o.ReferenceUrl, "Branch identity has a primary institutional/IEEE reference. This does not establish an open registration or unrestricted social API access.") { UniversityId = o.UniversityId, OrganizationId = o.Id })).ToArray();
    }
}
