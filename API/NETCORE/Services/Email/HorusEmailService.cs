/**
 * Arquivo: API/NETCORE/Services/Email/HorusEmailService.cs
 * Objetivo: centraliza montagem e envio de e-mails transacionais da API.
 * Entradas esperadas: recebe destinatário, contexto da empresa e dados do fluxo para envio por SMTP.
 */
using System.Net;
using System.Net.Mail;
using HORUSPDV_API.Repositories.DataAccess;
using HORUSPDV_API.Repositories.DatabaseAccess;
using Microsoft.Extensions.Options;

namespace HORUSPDV_API.Services.Email;

public class HorusEmailService(
    IOptions<HorusEmailOptions> options,
    EmpresaAB empresaAB,
    ILogger<HorusEmailService> logger)
{
    private readonly HorusEmailOptions _options = options.Value;

    public bool IsEnabled => _options.Enabled;

    public async Task<bool> IsEnabledAsync()
    {
        var settings = await ResolveSmtpSettingsAsync(CancellationToken.None);
        return settings.Enabled;
    }

    public async Task SendPasswordResetEmailAsync(
        string toEmail,
        string companyName,
        string resetUrl,
        DateTimeOffset expiresAt,
        CancellationToken cancellationToken)
    {
        if (!await IsEnabledAsync())
        {
            logger.LogInformation("Envio de e-mail desabilitado. Link de recuperação gerado para {Email}.", toEmail);
            return;
        }

        await SendEmailAsync(new EmailPayload(
            toEmail,
            "Recuperação de senha - Hórus PDV",
            HorusEmailTemplate.BuildPasswordResetHtml(companyName, resetUrl, expiresAt),
            HorusEmailTemplate.BuildPasswordResetText(companyName, resetUrl, expiresAt)), cancellationToken);
    }

    public async Task SendSignupWelcomeEmailAsync(
        string toEmail,
        string companyName,
        CancellationToken cancellationToken)
    {
        if (!await IsEnabledAsync())
        {
            logger.LogInformation("Envio de e-mail desabilitado. E-mail de cadastro não enviado para {Email}.", toEmail);
            return;
        }

        var loginUrl = ResolveFrontendBaseUrl();
        await SendEmailAsync(new EmailPayload(
            toEmail,
            "Cadastro criado - Hórus PDV",
            HorusEmailTemplate.BuildSignupWelcomeHtml(companyName, loginUrl),
            HorusEmailTemplate.BuildSignupWelcomeText(companyName, loginUrl)), cancellationToken);
    }

    public string BuildPasswordResetUrl(string token)
    {
        var baseUrl = ResolveFrontendBaseUrl();
        var encodedToken = Uri.EscapeDataString(token.Trim());
        return $"{baseUrl}/?resetToken={encodedToken}";
    }

    private async Task SendEmailAsync(EmailPayload payload, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(payload.ToEmail) || !payload.ToEmail.Contains('@'))
        {
            throw new InvalidOperationException("E-mail de destino inválido.");
        }

        var settings = await ResolveSmtpSettingsAsync(cancellationToken);
        ValidateSmtpConfiguration(settings);
        using var message = new MailMessage
        {
            From = new MailAddress(settings.FromEmail, settings.FromName),
            Subject = payload.Subject,
            Body = payload.HtmlBody,
            IsBodyHtml = true
        };
        message.To.Add(new MailAddress(payload.ToEmail.Trim().ToLowerInvariant()));
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
            payload.TextBody,
            null,
            "text/plain"));

        if (!string.IsNullOrWhiteSpace(settings.ReplyTo))
        {
            message.ReplyToList.Add(new MailAddress(settings.ReplyTo));
        }

        using var client = new SmtpClient(settings.Host, settings.Port)
        {
            EnableSsl = settings.EnableSsl,
            Credentials = new NetworkCredential(settings.User, settings.Password),
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        await client.SendMailAsync(message, cancellationToken);
    }

    private string ResolveFrontendBaseUrl()
        => string.IsNullOrWhiteSpace(_options.FrontendBaseUrl)
            ? "http://localhost:5173"
            : _options.FrontendBaseUrl.Trim().TrimEnd('/');

    private async Task<SmtpSettings> ResolveSmtpSettingsAsync(CancellationToken cancellationToken)
    {
        var empresa = await empresaAB.ObterPrincipalAsync();
        if (empresa is not null && empresa.EmailSmtpEnabled)
        {
            return FromCompany(empresa);
        }

        return new SmtpSettings(
            _options.Enabled,
            _options.Host,
            _options.Port,
            _options.EnableSsl,
            _options.User,
            _options.Password,
            _options.FromEmail,
            _options.FromName,
            _options.ReplyTo);
    }

    private static SmtpSettings FromCompany(EmpresaAD empresa)
        => new(
            empresa.EmailSmtpEnabled,
            empresa.EmailSmtpHost,
            empresa.EmailSmtpPort,
            empresa.EmailSmtpEnableSsl,
            empresa.EmailSmtpUser,
            empresa.EmailSmtpPassword,
            empresa.EmailSmtpFromEmail,
            string.IsNullOrWhiteSpace(empresa.EmailSmtpFromName) ? empresa.FantasyName : empresa.EmailSmtpFromName,
            empresa.EmailSmtpReplyTo);

    private static void ValidateSmtpConfiguration(SmtpSettings settings)
    {
        if (!settings.Enabled ||
            string.IsNullOrWhiteSpace(settings.Host) ||
            settings.Port <= 0 ||
            string.IsNullOrWhiteSpace(settings.User) ||
            string.IsNullOrWhiteSpace(settings.Password) ||
            string.IsNullOrWhiteSpace(settings.FromEmail))
        {
            throw new InvalidOperationException("Serviço de e-mail não configurado. Configure o SMTP em Minha Empresa.");
        }
    }

    private sealed record EmailPayload(string ToEmail, string Subject, string HtmlBody, string TextBody);

    private sealed record SmtpSettings(
        bool Enabled,
        string Host,
        int Port,
        bool EnableSsl,
        string User,
        string Password,
        string FromEmail,
        string FromName,
        string ReplyTo);
}
