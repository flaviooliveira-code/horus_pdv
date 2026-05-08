/**
 * Arquivo: API/NETCORE/Program.cs
 * Objetivo: configura serviços, middlewares, CORS, autenticação e inicialização da API do Hórus PDV.
 * Entradas esperadas: espera configurações de ambiente/appsettings e registra o pipeline HTTP da aplicação.
 */
using HORUSPDV_API.Middlewares;
using HORUSPDV_API.Repositories;
using HORUSPDV_API.Repositories.DatabaseAccess;
using HORUSPDV_API.Services.Caixa;
using HORUSPDV_API.Services.Clientes;
using HORUSPDV_API.Services.Email;
using HORUSPDV_API.Services.Fornecedores;
using HORUSPDV_API.Services.Produtos;
using HORUSPDV_API.Services.Security;

var builder = WebApplication.CreateBuilder(args);

var corsOrigins = (builder.Configuration["Security:CorsOrigins"] ??
                   "http://localhost:5173,https://localhost:5173,http://127.0.0.1:5173,https://127.0.0.1:5173,http://localhost:4173,https://localhost:4173,http://127.0.0.1:4173,https://127.0.0.1:4173")
    .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.Configure<HorusEmailOptions>(builder.Configuration.GetSection("Email"));

builder.Services.AddCors(options =>
{
    options.AddPolicy("HorusPdvCorsPolicy", policyBuilder =>
    {
        policyBuilder
            .WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddSingleton<Connection>();
builder.Services.AddScoped<ProdutoAB>();
builder.Services.AddScoped<ClienteAB>();
builder.Services.AddScoped<FornecedorAB>();
builder.Services.AddScoped<EmpresaAB>();
builder.Services.AddScoped<HistoricoVendasAB>();
builder.Services.AddScoped<ModuloMercadoAB>();
builder.Services.AddScoped<CaixaAB>();
builder.Services.AddScoped<HorusCaixaService>();
builder.Services.AddScoped<HorusSecurityStore>();
builder.Services.AddSingleton<HorusSecurityOptions>();
builder.Services.AddSingleton<HorusSecretProtector>();
builder.Services.AddSingleton<HorusJwtService>();
builder.Services.AddScoped<HorusEmailService>();
builder.Services.AddHttpClient<HorusRecaptchaService>();
builder.Services.AddScoped<IProdutoService, ProdutoService>();
builder.Services.AddScoped<IClienteService, ClienteService>();
builder.Services.AddScoped<IFornecedorService, FornecedorService>();

var app = builder.Build();

app.Services.GetRequiredService<HorusSecurityOptions>().Validate();
await HorusDatabaseInitializer.InitializeAsync(app.Services);

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler(errorApp =>
    {
        errorApp.Run(async context =>
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                message = "Erro interno no servidor."
            });
        });
    });
    app.UseHsts();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseRouting();
app.UseMiddleware<HorusSecurityHeadersMiddleware>();
app.UseCors("HorusPdvCorsPolicy");
app.UseMiddleware<HorusRequestTelemetryMiddleware>();
app.UseMiddleware<HorusRequestBodyLimitMiddleware>();
app.UseMiddleware<HorusRateLimitMiddleware>();
app.UseMiddleware<HorusAuthMiddleware>();
app.UseAuthorization();

app.UseSwagger();
app.UseSwaggerUI();

app.MapControllers();

app.Run();
