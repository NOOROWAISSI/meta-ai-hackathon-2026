using NextStep.Api;

public sealed class FakeEmailSender : IEmailSender
{
    public bool Configured => true;
    public bool Fail;
    public readonly Dictionary<string, string> Codes = [];
    public Task SendPasswordCode(string address, string code, string language, CancellationToken ct)
    {
        if (Fail) throw new ApiFault("provider_unavailable", "Synthetic mail failure", true);
        Codes[address] = code; return Task.CompletedTask;
    }
}
