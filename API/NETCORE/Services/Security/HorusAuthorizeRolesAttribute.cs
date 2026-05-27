/**
 * Arquivo: API/NETCORE/Services/Security/HorusAuthorizeRolesAttribute.cs
 * Objetivo: declarar perfis autorizados em controllers/actions sem acoplar regra ao frontend.
 * Entradas esperadas: recebe lista de roles normalizadas aceitas para a rota.
 */
namespace HORUSPDV_API.Services.Security;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class HorusAuthorizeRolesAttribute(params string[] roles) : Attribute
{
    public IReadOnlySet<string> Roles { get; } = roles
        .Select(role => role.Trim().ToLowerInvariant())
        .Where(role => !string.IsNullOrWhiteSpace(role))
        .ToHashSet(StringComparer.OrdinalIgnoreCase);
}
