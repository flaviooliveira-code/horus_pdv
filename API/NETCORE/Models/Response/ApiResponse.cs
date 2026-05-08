/**
 * Arquivo: API/NETCORE/Models/Response/ApiResponse.cs
 * Objetivo: define envelope padronizado de resposta usado pelos endpoints da API.
 * Entradas esperadas: recebe dados opcionais, mensagens e detalhes para retorno consistente ao frontend.
 */
namespace HORUSPDV_API.Models.Response;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Details { get; set; }
    public T? Data { get; set; }
}
