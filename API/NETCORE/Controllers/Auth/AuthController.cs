/**
 * Arquivo: API/NETCORE/Controllers/Auth/AuthController.cs
 * Objetivo: expõe endpoints HTTP de autenticação, cadastro, recuperação de senha e sessões e padroniza respostas para o frontend.
 * Entradas esperadas: recebe requisições REST, valida dados básicos e delega regras para serviços/repositórios.
 */
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Email;
using HORUSPDV_API.Services.Security;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Auth;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    HorusSecurityStore securityStore,
    HorusJwtService jwtService,
    HorusRecaptchaService recaptchaService,
    HorusEmailService emailService,
    ILogger<AuthController> logger) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Informe e-mail e senha."
            });
        }

        var ip = GetClientIp();
        var recaptchaValidation = await recaptchaService.VerifyAsync(
            request.RecaptchaToken,
            "login",
            ip,
            HttpContext.RequestAborted);
        if (!recaptchaValidation.Success)
        {
            return StatusCode(recaptchaValidation.StatusCode, new ApiResponse<object>
            {
                Success = false,
                Message = recaptchaValidation.Message,
                Details = recaptchaValidation.Details
            });
        }

        var userAgent = Request.Headers.UserAgent.ToString();
        var result = securityStore.Authenticate(request.Email, request.Password, ip, userAgent);
        if (!result.Success || result.User is null || result.Session is null)
        {
            return StatusCode(result.LockedUntil is null ? StatusCodes.Status401Unauthorized : StatusCodes.Status429TooManyRequests, new ApiResponse<object>
            {
                Success = false,
                Message = result.Message,
                Data = result.LockedUntil is null ? null : new { lockedUntil = result.LockedUntil.Value.ToString("o") }
            });
        }

        var token = jwtService.CreateToken(result.User, result.Session, ip);
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Login realizado com sucesso.",
            Data = new
            {
                token,
                tokenType = "Bearer",
                expiresInSeconds = jwtService.SessionHours * 60 * 60,
                sessionId = result.Session.Id,
                user = result.User
            }
        });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (!HorusSecurityStore.IsValidCnpj(request.Cnpj))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Informe um CNPJ válido."
            });
        }

        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Informe um e-mail válido."
            });
        }

        var recaptchaValidation = await recaptchaService.VerifyAsync(
            request.RecaptchaToken,
            "password_forgot_request",
            GetClientIp(),
            HttpContext.RequestAborted);
        if (!recaptchaValidation.Success)
        {
            return StatusCode(recaptchaValidation.StatusCode, new ApiResponse<object>
            {
                Success = false,
                Message = recaptchaValidation.Message,
                Details = recaptchaValidation.Details
            });
        }

        var ip = GetClientIp();
        var userAgent = Request.Headers.UserAgent.ToString();
        var resetRequest = securityStore.CreatePasswordResetToken(request.Cnpj, request.Email, ip, userAgent);
        if (!string.IsNullOrWhiteSpace(resetRequest.ResetToken) && resetRequest.ExpiresAt is not null)
        {
            var resetUrl = emailService.BuildPasswordResetUrl(resetRequest.ResetToken);
            try
            {
                await emailService.SendPasswordResetEmailAsync(
                    request.Email,
                    "Hórus PDV",
                    resetUrl,
                    resetRequest.ExpiresAt.Value,
                    HttpContext.RequestAborted);
            }
            catch (Exception ex)
            {
                securityStore.ConsumePasswordResetToken(resetRequest.ResetToken, ip, userAgent);
                logger.LogWarning(ex, "Não foi possível enviar e-mail de recuperação para {Email}.", request.Email);
                return StatusCode(StatusCodes.Status502BadGateway, new ApiResponse<object>
                {
                    Success = false,
                    Message = "Não foi possível enviar o e-mail de recuperação. Verifique a configuração SMTP."
                });
            }
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.",
            Data = await emailService.IsEnabledAsync()
                ? new
                {
                    resetRequest.Accepted,
                    resetRequest.MaskedEmail,
                    resetRequest.ExpiresAt
                }
                : resetRequest
        });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPasswordWithToken([FromBody] ResetPasswordWithTokenRequest request)
    {
        var recaptchaValidation = await recaptchaService.VerifyAsync(
            request.RecaptchaToken,
            "password_reset",
            GetClientIp(),
            HttpContext.RequestAborted);
        if (!recaptchaValidation.Success)
        {
            return StatusCode(recaptchaValidation.StatusCode, new ApiResponse<object>
            {
                Success = false,
                Message = recaptchaValidation.Message,
                Details = recaptchaValidation.Details
            });
        }

        try
        {
            var user = securityStore.ResetPasswordWithToken(
                request.Token,
                request.NextPassword,
                request.ConfirmPassword,
                GetClientIp(),
                Request.Headers.UserAgent.ToString());
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Senha redefinida com sucesso.",
                Data = user
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] AuthRegisterRequest request)
    {
        var recaptchaValidation = await recaptchaService.VerifyAsync(
            request.RecaptchaToken,
            "signup_complete",
            GetClientIp(),
            HttpContext.RequestAborted);
        if (!recaptchaValidation.Success)
        {
            return StatusCode(recaptchaValidation.StatusCode, new ApiResponse<object>
            {
                Success = false,
                Message = recaptchaValidation.Message,
                Details = recaptchaValidation.Details
            });
        }

        try
        {
            var user = securityStore.RegisterPublicUser(request);
            try
            {
                await emailService.SendSignupWelcomeEmailAsync(
                    request.Email,
                    request.Name,
                    HttpContext.RequestAborted);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Não foi possível enviar e-mail de cadastro para {Email}.", request.Email);
            }

            return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>
            {
                Success = true,
                Message = "Cadastro criado com sucesso.",
                Data = user
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("me")]
    public IActionResult Me()
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        var user = securityStore.GetActiveUser(currentUser.Id);
        if (user is null)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Usuario inativo ou inexistente." });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Usuario autenticado obtido com sucesso.",
            Data = user
        });
    }

    [HttpPut("me")]
    public IActionResult UpdateMe([FromBody] UpdateProfileRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var user = securityStore.UpdateOwnProfile(
                currentUser.Id,
                request.Name,
                request.Email,
                request.Phone);
            if (user is null)
            {
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "Usuário inativo ou inexistente." });
            }

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Perfil atualizado com sucesso.",
                Data = user
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        if (HttpContext.Items["CurrentUser"] is AuthenticatedUser currentUser)
        {
            securityStore.TerminateCurrentSession(currentUser.SessionId);
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Logout realizado com sucesso."
        });
    }

    [HttpPost("change-password")]
    public IActionResult ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (HttpContext.Items["CurrentUser"] is not AuthenticatedUser currentUser)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Sessão não encontrada." });
        }

        try
        {
            var changed = securityStore.ChangePassword(currentUser.Id, request.CurrentPassword, request.NextPassword);
            if (!changed)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = "Senha atual inválida."
                });
            }

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Senha atualizada com sucesso. Faça login novamente."
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    private string GetClientIp()
    {
        var forwarded = Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            return forwarded.Split(',')[0].Trim();
        }

        return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0";
    }

    public class UpdateProfileRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }
}
