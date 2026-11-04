namespace NextStep.Api;

// Versioned disclosure gate for outbound plan generation. The disclosure text
// lives in the frontend; this policy owns the version and the enforcement,
// and DisclosureStore owns persistence (a separate table, so earlier builds
// rolling back never meet state they cannot read). Bump CurrentVersion
// whenever the disclosed categories or provider change: existing
// acknowledgments become outdated and generation re-prompts.
public static class Disclosure
{
    public const int CurrentVersion = 1;

    public static bool IsCurrent(DisclosureAck? acknowledgment) =>
        acknowledgment is not null && acknowledgment.Version >= CurrentVersion;

    public static DisclosureStatus Status(DisclosureAck? acknowledgment) => new(
        CurrentVersion,
        acknowledgment?.Version,
        acknowledgment?.AcknowledgedAt,
        !IsCurrent(acknowledgment));

    public static void RequireCurrent(DisclosureAck? acknowledgment)
    {
        if (!IsCurrent(acknowledgment))
            throw new ApiFault("disclosure_required",
                "Review and acknowledge the data-sharing disclosure before generating a draft. Nothing was sent and no draft was saved.");
    }
}
