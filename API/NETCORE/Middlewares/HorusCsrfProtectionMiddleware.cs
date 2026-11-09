/**
 * Arquivo: API/NETCORE/Middlewares/HorusCsrfProtectionMiddleware.cs
 * Objetivo: bloqueia requisições que alteram estado vindas de origens não autorizadas (defesa contra CSRF na autenticação por cookie).
 * Entradas esperadas: recebe HttpContext do pipeline ASP.NET Core e a lista de origens permitidas (a mesma do CORS).
 */
using HORUSPDV_API.Models.Response;

namespace HORUSPDV_API.Middlewares;

public class HorusCsrfProtectionMiddleware(RequestDelegate next, string[] allowedOrigins)
{
    private readonly HashSet<string> _allowedOrigins = new(
        allowedOrigins.Select(NormalizeOrigin),
        StringComparer.OrdinalIgnoreCase);

    public async Task InvokeAsync(HttpContext context)
    {
        if (IsSafeMethod(context.Request.Method) || IsTrustedRequest(context.Request))
        {
            await next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new ApiResponse<object>
        {
            Success = false,
            Message = "Origem da requisição não autorizada."
        });
    }

    private static bool IsSafeMethod(string method) =>
        HttpMethods.IsGet(method) ||
        HttpMethods.IsHead(method) ||
        HttpMethods.IsOptions(method) ||
        HttpMethods.IsTrace(method);

    private bool IsTrustedRequest(HttpRequest request)
    {
        var fetchSite = request.Headers["Sec-Fetch-Site"].ToString();
        var origin = request.Headers.Origin.ToString();

        // Navegadores modernos enviam Sec-Fetch-Site, que a página não consegue forjar.
        if (fetchSite.Equals("same-origin", StringComparison.OrdinalIgnoreCase) ||
            fetchSite.Equals("none", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!string.IsNullOrWhiteSpace(origin))
        {
            return IsAllowedOrigin(origin, request);
        }

        // Sem Origin e sem Sec-Fetch-Site: não é um navegador (ex.: integração com Bearer token),
        // portanto não há risco de CSRF. Se só houver Sec-Fetch-Site de outro site, bloqueia.
        return string.IsNullOrWhiteSpace(fetchSite);
    }

    private bool IsAllowedOrigin(string origin, HttpRequest request)
    {
        if (origin.Equals("null", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var normalizedOrigin = NormalizeOrigin(origin);
        if (_allowedOrigins.Contains(normalizedOrigin))
        {
            return true;
        }

        var requestOrigin = NormalizeOrigin($"{request.Scheme}://{request.Host}");
        return normalizedOrigin.Equals(requestOrigin, StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeOrigin(string origin) => origin.Trim().TrimEnd('/');
}
