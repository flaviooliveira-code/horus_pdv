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
