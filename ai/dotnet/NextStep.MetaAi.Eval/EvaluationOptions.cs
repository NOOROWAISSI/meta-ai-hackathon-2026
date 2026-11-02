namespace NextStep.MetaAi.Evaluation;

// Parse and validate the entire selection before reading credentials or creating a client.
internal sealed record EvaluationOptions(bool Live, bool List, bool Help, IReadOnlySet<string> ScenarioIds, bool OfflineFixtures = false)
{
    internal static EvaluationOptions Parse(string[] args, IEnumerable<string> knownIds)
    {
        var known = knownIds.ToHashSet(StringComparer.Ordinal);
        var selected = new HashSet<string>(StringComparer.Ordinal);
        var live = false; var list = false; var help = false; var offlineFixtures = false;
        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--live": live = true; break;
                case "--list": list = true; break;
                case "--help": help = true; break;
                case "--offline-fixtures": offlineFixtures = true; break;
                case "--scenario":
                    if (++i >= args.Length || !known.Contains(args[i]))
                        throw new ArgumentException("--scenario needs a known scenario ID; use --list.");
                    selected.Add(args[i]); // Duplicate selections never multiply paid calls.
                    break;
                default: throw new ArgumentException("Unknown option; use --help.");
            }
        }
        if (offlineFixtures && live) throw new ArgumentException("--offline-fixtures cannot be combined with --live.");
        return new(live, list, help, selected.Count == 0 ? known : selected, offlineFixtures);
    }
}
