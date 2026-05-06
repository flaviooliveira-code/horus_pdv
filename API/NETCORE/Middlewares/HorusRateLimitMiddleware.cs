using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Services.Security;
using System.Collections.Concurrent;

namespace HORUSPDV_API.Middlewares;

public class HorusRateLimitMiddleware(RequestDelegate next)
{
    private static readonly ConcurrentDictionary<string, RequestBucket> Buckets = new();

    public async Task InvokeAsync(HttpContext context, HorusSecurityOptions securityOptions)
    {
        if (HttpMethods.IsOptions(context.Request.Method) || IsSwagger(context.Request.Path.Value))
        {
            await next(context);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var key = ResolveClientIp(context);
        var window = TimeSpan.FromSeconds(securityOptions.RequestRateLimitWindowSeconds);
        var bucket = Buckets.AddOrUpdate(
            key,
            _ => new RequestBucket { Count = 1, ExpiresAt = now.Add(window) },
            (_, current) =>
            {
                if (current.ExpiresAt <= now)
                {
                    current.Count = 1;
                    current.ExpiresAt = now.Add(window);
                }
                else
                {
                    current.Count += 1;
                }

                return current;
            });

        if (bucket.Count > securityOptions.RequestRateLimitMax)
        {
            var retryAfterSeconds = Math.Max(1, (int)Math.Ceiling((bucket.ExpiresAt - now).TotalSeconds));
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.Headers.RetryAfter = retryAfterSeconds.ToString();
            await context.Response.WriteAsJsonAsync(new ApiResponse<object>
            {
                Success = false,
                Message = "Limite de requisições excedido. Tente novamente em instantes."
            });
            return;
        }

        CleanupExpired(now);
        await next(context);
    }

    private static bool IsSwagger(string? path)
        => !string.IsNullOrWhiteSpace(path) && path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase);

    private static string ResolveClientIp(HttpContext context)
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            return forwarded.Split(',')[0].Trim();
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static void CleanupExpired(DateTimeOffset now)
    {
        if (Buckets.Count < 500) return;

        foreach (var item in Buckets)
        {
            if (item.Value.ExpiresAt <= now)
            {
                Buckets.TryRemove(item.Key, out _);
            }
        }
    }
}

internal class RequestBucket
{
    public int Count { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
