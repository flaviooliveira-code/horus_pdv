namespace HORUSPDV_API.Middlewares;

public class HorusSecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
        context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
        context.Response.Headers.TryAdd("Referrer-Policy", "no-referrer");
        context.Response.Headers.TryAdd("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        context.Response.Headers.TryAdd("X-Permitted-Cross-Domain-Policies", "none");
        context.Response.Headers.TryAdd("Cross-Origin-Resource-Policy", "same-site");
        context.Response.Headers.TryAdd("Cache-Control", "no-store");
        context.Response.Headers.Remove("Server");
        context.Response.Headers.Remove("X-Powered-By");

        await next(context);
    }
}
