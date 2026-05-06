using HORUSPDV_API.Data;
using HORUSPDV_API.Data.Entities;
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Models.Response;
using Microsoft.AspNetCore.Mvc;

namespace HORUSPDV_API.Controllers.Empresa;

[ApiController]
[Route("api/[controller]")]
public class EmpresaController(HorusDbContext db) : ControllerBase
{
    [HttpGet]
    public IActionResult Obter()
    {
        var empresa = db.Empresas.FirstOrDefault(item => item.Id == "empresa-principal");
        if (empresa is null)
        {
            return NotFound(new ApiResponse<EmpresaRequest> { Success = false, Message = "Empresa nao encontrada." });
        }

        return Ok(new ApiResponse<EmpresaRequest>
        {
            Success = true,
            Message = "Dados da empresa obtidos com sucesso.",
            Data = ToRequest(empresa)
        });
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

        var empresa = db.Empresas.FirstOrDefault(item => item.Id == "empresa-principal");
        if (empresa is null)
        {
            empresa = new EmpresaEntity { Id = "empresa-principal" };
            db.Empresas.Add(empresa);
        }

        Apply(empresa, request);
        db.SaveChanges();
        return Ok(new ApiResponse<EmpresaRequest>
        {
            Success = true,
            Message = "Dados da empresa atualizados com sucesso.",
            Data = ToRequest(empresa)
        });
    }

    private static void Apply(EmpresaEntity target, EmpresaRequest source)
    {
        target.FantasyName = source.FantasyName.Trim();
        target.CorporateName = source.CorporateName.Trim();
        target.Cnpj = source.Cnpj.Trim();
        target.StateRegistration = source.StateRegistration.Trim();
        target.Website = source.Website.Trim();
        target.Email = source.Email.Trim();
        target.SacPhone = source.SacPhone.Trim();
        target.Phone = source.Phone.Trim();
        target.Mobile = source.Mobile.Trim();
        target.Cep = source.Cep.Trim();
        target.Address = source.Address.Trim();
        target.Number = source.Number.Trim();
        target.Neighborhood = source.Neighborhood.Trim();
        target.City = source.City.Trim();
        target.Uf = source.Uf.Trim();
        target.Complement = source.Complement.Trim();
    }

    private static EmpresaRequest ToRequest(EmpresaEntity source) => new()
    {
        FantasyName = source.FantasyName,
        CorporateName = source.CorporateName,
        Cnpj = source.Cnpj,
        StateRegistration = source.StateRegistration,
        Website = source.Website,
        Email = source.Email,
        SacPhone = source.SacPhone,
        Phone = source.Phone,
        Mobile = source.Mobile,
        Cep = source.Cep,
        Address = source.Address,
        Number = source.Number,
        Neighborhood = source.Neighborhood,
        City = source.City,
        Uf = source.Uf,
        Complement = source.Complement
    };
}
