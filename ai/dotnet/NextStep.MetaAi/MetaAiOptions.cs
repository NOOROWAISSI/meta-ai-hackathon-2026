namespace NextStep.MetaAi;

public sealed class MetaAiOptions
{
    public const string SectionName = "MetaAi";
    public string Model { get; set; } = "muse-spark-1.3";
    public string ChatCompletionsUrl { get; set; } = "https://api.meta.ai/v1/chat/completions";
    public string ApiKey { get; set; } = "";
    public int AttemptTimeoutSeconds { get; set; } = 30;
    public int OverallTimeoutSeconds { get; set; } = 60;
    public int MaxRetries { get; set; } = 1;
    public int MaxRetryDelaySeconds { get; set; } = 5;
    public int MaxResponseBytes { get; set; } = 131072;
}
public sealed class MetaAiException : Exception
{
    public AiApiError Error { get; }
    public MetaAiException(string code, string message, bool retryable = false) : base(message)
        => Error = new(code, message, Guid.NewGuid().ToString("N"), retryable);
}
