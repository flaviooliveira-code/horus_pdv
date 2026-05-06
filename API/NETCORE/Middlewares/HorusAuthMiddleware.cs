using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Services.Security;

namespace HORUSPDV_API.Middlewares;

public class HorusAuthMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, HorusJwtService jwtService, HorusSecurityStore securityStore)
    {
        if (ShouldSkipAuth(context))
        {
            await next(context);
            return;
        }

        var authHeader = context.Request.Headers.Authorization.ToString();
        var token = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authHeader["Bearer ".Length..].Trim()
            : "";

        var authenticatedUser = string.IsNullOrWhiteSpace(token) ? null : jwtService.ValidateToken(token);
        if (authenticatedUser is null ||
            !securityStore.IsSessionActive(authenticatedUser.SessionId) ||
            securityStore.GetActiveUser(authenticatedUser.Id) is null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new ApiResponse<object>
            {
                Success = false,
                Message = "Sessao expirada ou token invalido."
            });
            return;
        }

        context.Items["CurrentUser"] = authenticatedUser;
        await next(context);
    }

    private static bool ShouldSkipAuth(HttpContext context)
    {
        if (HttpMethods.IsOptions(context.Request.Method)) return true;

        var path = context.Request.Path.Value ?? "";
        return path.StartsWith("/api/Auth/login", StringComparison.OrdinalIgnoreCase) ||
               path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase);
    }
}
