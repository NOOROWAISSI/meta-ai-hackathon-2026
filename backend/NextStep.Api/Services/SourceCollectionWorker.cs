namespace NextStep.Api;

public sealed class SourceCollectionWorker(SourceCollector collector, IConfiguration configuration, IWebHostEnvironment environment, ILogger<SourceCollectionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue<bool>("SourceCollection:Enabled") || environment.IsEnvironment("Testing")) return;
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        while (!stoppingToken.IsCancellationRequested) {
            try { await collector.CollectDue(false, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logger.LogWarning("Source collection could not finish. Existing listings were preserved; the worker will retry."); }
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
