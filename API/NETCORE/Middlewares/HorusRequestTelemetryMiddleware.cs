using HORUSPDV_API.Services.Security;

namespace HORUSPDV_API.Middlewares;

public class HorusRequestTelemetryMiddleware(RequestDelegate next, ILogger<HorusRequestTelemetryMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var requestId = Guid.NewGuid().ToString("N");
        var startedAt = DateTimeOffset.UtcNow;
        context.Items["RequestId"] = requestId;
        context.Response.Headers.TryAdd("X-Request-Id", requestId);

        try
        {
            await next(context);
        }
        finally
        {
            var durationMs = Math.Max(0, (DateTimeOffset.UtcNow - startedAt).TotalMilliseconds);
            var currentUser = context.Items["CurrentUser"] as AuthenticatedUser;
            logger.LogInformation(
                "http.request.completed requestId={RequestId} method={Method} path={Path} statusCode={StatusCode} durationMs={DurationMs} userId={UserId} sessionId={SessionId} ip={Ip}",
                requestId,
                context.Request.Method,
                context.Request.Path.Value,
                context.Response.StatusCode,
                Math.Round(durationMs),
                currentUser?.Id,
                currentUser?.SessionId,
                ResolveClientIp(context));
        }
    }

    private static string ResolveClientIp(HttpContext context)
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            return forwarded.Split(',')[0].Trim();
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
