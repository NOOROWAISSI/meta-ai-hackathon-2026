namespace NextStep.Api;

// Versioned disclosure gate for outbound plan generation. The disclosure text
// lives in the frontend; this policy owns the version and the enforcement.
// Bump CurrentVersion whenever the disclosed categories or provider change:
// existing acknowledgments become outdated and generation re-prompts.
public static class Disclosure
{
    public const int CurrentVersion = 1;

    public static bool IsCurrent(DisclosureAck? acknowledgment) =>
        acknowledgment is not null && acknowledgment.Version >= CurrentVersion;

    public static DisclosureStatus Status(UserState state) => new(
        CurrentVersion,
        state.Disclosure?.Version,
        state.Disclosure?.AcknowledgedAt,
        !IsCurrent(state.Disclosure));

    public static void RequireCurrent(UserState state)
    {
        if (!IsCurrent(state.Disclosure))
            throw new ApiFault("disclosure_required",
                "Review and acknowledge the data-sharing disclosure before generating a draft. Nothing was sent and no draft was saved.");
    }

    public static DisclosureStatus Acknowledge(UserState state)
    {
        state.Disclosure = new DisclosureAck(CurrentVersion, DateTimeOffset.UtcNow.ToString("O"));
        return Status(state);
    }

    public static DisclosureStatus Withdraw(UserState state)
    {
        state.Disclosure = null;
        return Status(state);
    }
}
