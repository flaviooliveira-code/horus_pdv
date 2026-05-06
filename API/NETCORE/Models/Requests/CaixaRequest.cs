namespace HORUSPDV_API.Models.Requests;

public class AbrirCaixaRequest
{
    public string OpeningAmount { get; set; } = "0,00";
}

public class FecharCaixaRequest
{
    public string ClosingAmount { get; set; } = "0,00";
    public string Note { get; set; } = "";
}
