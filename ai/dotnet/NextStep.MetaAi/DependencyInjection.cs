using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace NextStep.MetaAi;

public static class DependencyInjection
{
    public static IServiceCollection AddMetaAiClient(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<MetaAiOptions>(configuration.GetSection(MetaAiOptions.SectionName));
        services.PostConfigure<MetaAiOptions>(o =>
        {
            var key = Environment.GetEnvironmentVariable("MODEL_API_KEY");
            if (!string.IsNullOrWhiteSpace(key)) o.ApiKey = key;
        });
        services.AddHttpClient<IMetaModelClient, MetaModelClient>(http =>
            http.Timeout = Timeout.InfiniteTimeSpan)
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        return services;
    }
}
