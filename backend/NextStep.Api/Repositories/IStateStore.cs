namespace NextStep.Api;

public interface IStateStore
{
    Task<string> CreateSession(CancellationToken ct);
    Task<string?> ResolveSession(string token, CancellationToken ct);
    Task<T> Read<T>(string owner, Func<UserState, T> read, CancellationToken ct);
    Task<T> Change<T>(string owner, Func<UserState, T> change, CancellationToken ct);
    Task Delete(string owner, CancellationToken ct);
    Task<bool> Healthy(CancellationToken ct);
}
