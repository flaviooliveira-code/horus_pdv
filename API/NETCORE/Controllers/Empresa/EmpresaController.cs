using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Empresa;

[ApiController]
[Route("api/[controller]")]
public class EmpresaController : ControllerBase
{
    private static readonly object SyncRoot = new();
    private static EmpresaRequest Empresa = new()
    {
        FantasyName = "Festa & Fantasia",
        CorporateName = "Festa & Fantasia Comercio LTDA",
        Cnpj = "06.332.765/0001-05",
        StateRegistration = "123.456.789.110",
        Website = "https://www.horuspdv.com.br",
        Email = "contato@hpdv.com.br",
        SacPhone = "(11) 3000-1000",
        Phone = "(11) 3681-1000",
        Mobile = "(11) 98888-1000",
        Cep = "06010-000",
        Address = "Rua Primitiva Vianco",
        Number = "100",
        Neighborhood = "Centro",
        City = "Osasco",
        Uf = "SP",
        Complement = "Sala 12"
    };

    [HttpGet]
    public IActionResult Obter()
    {
        lock (SyncRoot)
        {
            return Ok(new ApiResponse<EmpresaRequest>
            {
                Success = true,
                Message = "Dados da empresa obtidos com sucesso.",
                Data = Clone(Empresa)
            });
        }
    }

    [HttpPut]
    public IActionResult Atualizar([FromBody] EmpresaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FantasyName) || request.FantasyName.Trim().Length < 3)
        {
            return BadRequest(new ApiResponse<EmpresaRequest> { Success = false, Message = "Nome fantasia e obrigatorio." });
        }

        if (request.Cnpj.Count(char.IsDigit) != 14)
        {
            return BadRequest(new ApiResponse<EmpresaRequest> { Success = false, Message = "CNPJ invalido." });
        }

        lock (SyncRoot)
        {
            Empresa = Clone(request);
            return Ok(new ApiResponse<EmpresaRequest>
            {
                Success = true,
                Message = "Dados da empresa atualizados com sucesso.",
                Data = Clone(Empresa)
            });
        }
    }

    private static EmpresaRequest Clone(EmpresaRequest source) => new()
    {
        FantasyName = source.FantasyName.Trim(),
        CorporateName = source.CorporateName.Trim(),
        Cnpj = source.Cnpj.Trim(),
        StateRegistration = source.StateRegistration.Trim(),
        Website = source.Website.Trim(),
        Email = source.Email.Trim(),
        SacPhone = source.SacPhone.Trim(),
        Phone = source.Phone.Trim(),
        Mobile = source.Mobile.Trim(),
        Cep = source.Cep.Trim(),
        Address = source.Address.Trim(),
        Number = source.Number.Trim(),
        Neighborhood = source.Neighborhood.Trim(),
        City = source.City.Trim(),
        Uf = source.Uf.Trim(),
        Complement = source.Complement.Trim()
    };
}
