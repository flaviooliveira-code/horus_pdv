/**
 * Arquivo: API/NETCORE/Services/Security/HorusRoles.cs
 * Objetivo: centraliza os perfis com visão de supervisão (saldo esperado do caixa, relatórios contábeis).
 * Entradas esperadas: recebe o perfil do usuário autenticado (AuthenticatedUser.Role).
 */
namespace HORUSPDV_API.Services.Security;

public static class HorusRoles
{
    private static readonly HashSet<string> SupervisoryRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "administrador",
        "gerente",
        "financeiro"
    };

    /// <summary>Perfis que podem ver o saldo esperado de caixa aberto e os relatórios contábeis.</summary>
    public static IReadOnlyCollection<string> Supervisory => SupervisoryRoles;

    public static bool IsSupervisor(string? role)
        => !string.IsNullOrWhiteSpace(role) && SupervisoryRoles.Contains(role.Trim());
}
