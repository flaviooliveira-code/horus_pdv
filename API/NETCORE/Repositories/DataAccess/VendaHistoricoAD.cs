namespace HORUSPDV_API.Repositories.DataAccess;

public class VendaHistoricoAD
{
    public string SaleNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerCpf { get; set; } = string.Empty;
    public string PaymentType { get; set; } = string.Empty;
    public string TotalAmount { get; set; } = string.Empty;
    public string OperatorName { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string UnitPrice { get; set; } = string.Empty;
    public string ItemTotal { get; set; } = string.Empty;
    public string SaleDate { get; set; } = string.Empty;
}

public class VendaRegistroResultadoAD
{
    public string SaleNumber { get; set; } = string.Empty;
    public List<VendaHistoricoAD> Rows { get; set; } = [];
}
