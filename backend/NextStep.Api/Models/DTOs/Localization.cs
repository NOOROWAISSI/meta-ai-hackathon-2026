namespace NextStep.Api;

public sealed record CatalogTranslationRequest(string Language);
public sealed record TranslatedListing(string Id, string Title, string Summary, string VerificationNote);
public sealed record CatalogTranslation(string Language, string SourceRevision, string TranslationKind, TranslatedListing[] Items);
