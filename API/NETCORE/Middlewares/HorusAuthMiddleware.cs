/**
 * Arquivo: API/NETCORE/Middlewares/HorusAuthMiddleware.cs
 * Objetivo: intercepta requisições HTTP para aplicar regra transversal de autenticação, cadastro, recuperação de senha e sessões.
 * Entradas esperadas: recebe HttpContext do pipeline ASP.NET Core e decide se a requisição segue para o próximo middleware.
 */
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DatabaseAccess;
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
        var parts = authHeader.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var token = parts.Length == 2 && parts[0].Equals("Bearer", StringComparison.Ordinal)
            ? parts[1]
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
        var rolePolicy = context.GetEndpoint()?.Metadata.GetMetadata<HorusAuthorizeRolesAttribute>();
        if (rolePolicy is not null && rolePolicy.Roles.Count > 0 && !rolePolicy.Roles.Contains(authenticatedUser.Role))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new ApiResponse<object>
            {
                Success = false,
                Message = "Usuário sem permissão para esta ação."
            });
            return;
        }

        await next(context);
    }

    private static bool ShouldSkipAuth(HttpContext context)
    {
        if (HttpMethods.IsOptions(context.Request.Method)) return true;

        var path = context.Request.Path.Value ?? "";
        return path.StartsWith("/api/Auth/login", StringComparison.OrdinalIgnoreCase) ||
               path.StartsWith("/api/Auth/forgot-password", StringComparison.OrdinalIgnoreCase) ||
               path.StartsWith("/api/Auth/reset-password", StringComparison.OrdinalIgnoreCase) ||
               path.StartsWith("/api/Auth/register", StringComparison.OrdinalIgnoreCase) ||
               path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase);
    }
}
