/**
 * Arquivo: API/NETCORE/Middlewares/HorusRequestBodyLimitMiddleware.cs
 * Objetivo: limita o tamanho do corpo das requisições antes de processar endpoints sensíveis.
 * Entradas esperadas: recebe HttpContext do pipeline ASP.NET Core e decide se a requisição segue para o próximo middleware.
 */
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Services.Security;

namespace HORUSPDV_API.Middlewares;

public class HorusRequestBodyLimitMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, HorusSecurityOptions securityOptions)
    {
        var contentLength = context.Request.ContentLength;
        if (contentLength is not null && contentLength > securityOptions.MaxRequestBodyBytes)
        {
            context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
            await context.Response.WriteAsJsonAsync(new ApiResponse<object>
            {
                Success = false,
                Message = "Payload maior que o permitido."
            });
            return;
        }

        await next(context);
    }
}
