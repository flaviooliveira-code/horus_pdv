/**
 * Arquivo: API/NETCORE/Services/Email/HorusEmailTemplate.cs
 * Objetivo: monta templates HTML dos e-mails transacionais do Hórus PDV.
 * Entradas esperadas: recebe dados transacionais e retorna HTML pronto para envio de e-mail.
 */
using System.Net;
using System.Text;

namespace HORUSPDV_API.Services.Email;

public static class HorusEmailTemplate
{
    public static string BuildPasswordResetHtml(string companyName, string resetUrl, DateTimeOffset expiresAt)
    {
        var safeCompanyName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(companyName) ? "Hórus PDV" : companyName.Trim());
        var safeResetUrl = WebUtility.HtmlEncode(resetUrl);
        var expiresLabel = FormatDateTimePtBr(expiresAt);

        return $$"""
        <div style="margin:0;padding:24px;background:#f8fafc;font-family:Inter,Arial,Helvetica,sans-serif;color:#1e293b;line-height:1.55;">
          <div style="max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff;">
            <div style="padding:16px 24px;background:linear-gradient(135deg,#4f46e5 0%,#2563eb 52%,#0f766e 100%);">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#ffffff;opacity:.94;">
                Hórus PDV
              </p>
            </div>

            <div style="padding:24px;">
              <h1 style="margin:0 0 10px;font-size:24px;line-height:1.25;color:#111827;">
                Recuperação de senha
              </h1>
              <p style="margin:0 0 14px;color:#475569;">
                Recebemos uma solicitação para redefinir a senha de acesso da conta vinculada à empresa
                <strong style="color:#111827;">{{safeCompanyName}}</strong>.
              </p>
              <p style="margin:0 0 14px;color:#475569;">
                Clique no botão abaixo para criar uma nova senha:
              </p>

              <p style="margin:0 0 16px;">
                <a
                  href="{{safeResetUrl}}"
                  style="display:inline-block;padding:11px 18px;border-radius:10px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;"
                >
                  Redefinir senha
                </a>
              </p>

              <p style="margin:0 0 10px;color:#475569;">
                Se o botão não abrir, copie e cole este link no navegador:
              </p>
              <p style="margin:0 0 14px;word-break:break-all;">
                <a href="{{safeResetUrl}}" style="color:#4f46e5;text-decoration:none;">{{safeResetUrl}}</a>
              </p>

              <p style="margin:0 0 6px;font-size:14px;color:#475569;">
                Este link expira em <strong style="color:#111827;">{{expiresLabel}}</strong> (horário de Brasília).
              </p>
              <p style="margin:0;font-size:13px;color:#64748b;">
                Se você não solicitou a recuperação, ignore este e-mail.
              </p>
            </div>

            <div style="padding:12px 24px;border-top:1px solid #e5e7eb;background:#f8fafc;font-size:12px;color:#64748b;">
              Mensagem automática enviada por Hórus PDV. Não é necessário responder.
            </div>
          </div>
        </div>
        """;
    }

    public static string BuildPasswordResetText(string companyName, string resetUrl, DateTimeOffset expiresAt)
    {
        var lines = new[]
        {
            "Hórus PDV - Recuperação de senha",
            "",
            $"Empresa: {NormalizeText(companyName, "Hórus PDV")}",
            "Recebemos uma solicitação para redefinir sua senha.",
            $"Link: {resetUrl}",
            $"Expira em: {FormatDateTimePtBr(expiresAt)} (horário de Brasília)",
            "",
            "Se você não solicitou a recuperação, ignore este e-mail."
        };

        return string.Join(Environment.NewLine, lines);
    }

    public static string BuildSignupWelcomeHtml(string companyName, string loginUrl)
    {
        var safeCompanyName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(companyName) ? "sua empresa" : companyName.Trim());
        var safeLoginUrl = WebUtility.HtmlEncode(loginUrl);

        return $$"""
        <div style="margin:0;padding:24px;background:#f8fafc;font-family:Inter,Arial,Helvetica,sans-serif;color:#1e293b;line-height:1.55;">
          <div style="max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff;">
            <div style="padding:16px 24px;background:linear-gradient(135deg,#4f46e5 0%,#2563eb 52%,#0f766e 100%);">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#ffffff;opacity:.94;">
                Hórus PDV
              </p>
            </div>

            <div style="padding:24px;">
              <h1 style="margin:0 0 10px;font-size:24px;line-height:1.25;color:#111827;">
                Cadastro criado com sucesso
              </h1>
              <p style="margin:0 0 14px;color:#475569;">
                A conta da empresa <strong style="color:#111827;">{{safeCompanyName}}</strong> foi criada no Hórus PDV.
              </p>
              <p style="margin:0 0 14px;color:#475569;">
                Você já pode acessar o painel usando o e-mail e a senha cadastrados.
              </p>

              <p style="margin:0 0 16px;">
                <a
                  href="{{safeLoginUrl}}"
                  style="display:inline-block;padding:11px 18px;border-radius:10px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;"
                >
                  Acessar o Hórus PDV
                </a>
              </p>

              <p style="margin:0;font-size:13px;color:#64748b;">
                Se você não solicitou este cadastro, ignore este e-mail.
              </p>
            </div>

            <div style="padding:12px 24px;border-top:1px solid #e5e7eb;background:#f8fafc;font-size:12px;color:#64748b;">
              Mensagem automática enviada por Hórus PDV. Não é necessário responder.
            </div>
          </div>
        </div>
        """;
    }

    public static string BuildSignupWelcomeText(string companyName, string loginUrl)
    {
        var lines = new[]
        {
            "Hórus PDV - Cadastro criado",
            "",
            $"Empresa: {NormalizeText(companyName, "sua empresa")}",
            "Sua conta foi criada com sucesso.",
            $"Acesso: {loginUrl}",
            "",
            "Se você não solicitou este cadastro, ignore este e-mail."
        };

        return string.Join(Environment.NewLine, lines);
    }

    private static string FormatDateTimePtBr(DateTimeOffset value)
    {
        var brasiliaTime = TimeZoneInfo.ConvertTime(value, ResolveBrasiliaTimeZone());
        return brasiliaTime.ToString("dd/MM/yyyy HH:mm");
    }

    private static TimeZoneInfo ResolveBrasiliaTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time");
        }
    }

    private static string NormalizeText(string value, string fallback)
    {
        var normalized = value?.Trim();
        if (!string.IsNullOrWhiteSpace(normalized)) return normalized;
        return fallback;
    }
}
