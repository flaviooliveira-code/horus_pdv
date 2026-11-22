/**
 * Arquivo: API/NETCORE/Services/Produtos/BarcodeCatalogLookupService.cs
 * Objetivo: realiza busca melhor-esforço de nome, categoria, descrição e imagem a partir de um código de barras
 * em bases públicas (Cosmos opcional, Open Food/Beauty/Products/PetFood Facts e UPCitemdb) com cache em memória.
 * Entradas esperadas: recebe código numérico GTIN/EAN/UPC; falhas externas são silenciadas para não bloquear o cadastro.
 */
using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using HORUSPDV_API.Models.Produtos;

namespace HORUSPDV_API.Services.Produtos;

public sealed class BarcodeCatalogLookupService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<BarcodeCatalogLookupService> logger) : IBarcodeCatalogLookupService
{
    private sealed record CacheEntry(BarcodeLookupResponse Response, DateTimeOffset ExpiresAt);

    private static readonly ConcurrentDictionary<string, CacheEntry> Cache = new(StringComparer.Ordinal);
    private static readonly TimeSpan FoundCacheTtl = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan NotFoundCacheTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan PerSourceTimeout = TimeSpan.FromSeconds(4);

    private static readonly Dictionary<string, string> CategoryTranslations = new(StringComparer.OrdinalIgnoreCase)
    {
        ["beverages"] = "Bebidas",
        ["carbonated-drinks"] = "Bebidas",
        ["sodas"] = "Refrigerantes",
        ["waters"] = "Águas",
        ["juices"] = "Sucos",
        ["beers"] = "Cervejas",
        ["alcoholic-beverages"] = "Bebidas Alcoólicas",
        ["dairies"] = "Laticínios",
        ["milks"] = "Laticínios",
        ["cheeses"] = "Queijos e Frios",
        ["yogurts"] = "Laticínios",
        ["snacks"] = "Salgadinhos e Snacks",
        ["sweet-snacks"] = "Doces e Biscoitos",
        ["biscuits-and-cakes"] = "Biscoitos e Bolos",
        ["chocolates"] = "Chocolates e Doces",
        ["candies"] = "Doces e Balas",
        ["cereals-and-potatoes"] = "Mercearia",
        ["pasta"] = "Massas",
        ["breads"] = "Padaria",
        ["meats"] = "Carnes e Frios",
        ["fruits-and-vegetables"] = "Hortifruti",
        ["frozen-foods"] = "Congelados",
        ["condiments"] = "Temperos e Molhos",
        ["sauces"] = "Molhos e Condimentos",
        ["oils"] = "Óleos e Azeites",
        ["coffees"] = "Cafés e Chás",
        ["teas"] = "Cafés e Chás",
        ["cleaning-products"] = "Limpeza",
        ["household"] = "Casa e Limpeza",
        ["personal-care"] = "Higiene Pessoal",
        ["hair-care"] = "Higiene Pessoal",
        ["shampoos"] = "Higiene Pessoal",
        ["soaps"] = "Higiene Pessoal",
        ["cosmetics"] = "Cosméticos",
        ["deodorants"] = "Higiene Pessoal",
        ["oral-hygiene"] = "Higiene Bucal",
        ["pet-food"] = "Pet Shop",
        ["dog-food"] = "Pet Shop",
        ["cat-food"] = "Pet Shop",
        ["electronics"] = "Eletrônicos",
        ["office-supplies"] = "Papelaria"
    };

    public async Task<BarcodeLookupResponse> LookupAsync(string barcode, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeBarcode(barcode);
        if (normalized.Length < 8 || normalized.Length > 14)
        {
            return new BarcodeLookupResponse { Barcode = normalized, Found = false };
        }

        if (Cache.TryGetValue(normalized, out var cached) && cached.ExpiresAt > DateTimeOffset.UtcNow)
        {
            return cached.Response;
        }

        var merged = new BarcodeLookupResponse { Barcode = normalized, Found = false };

        // 1. Cosmos Bluesoft (se token configurado — excelente cobertura para códigos brasileiros 789/790)
        var cosmosToken = configuration["BarcodeLookup:CosmosToken"]?.Trim();
        if (!string.IsNullOrWhiteSpace(cosmosToken))
        {
            var cosmos = await TryLookupCosmosAsync(normalized, cosmosToken, cancellationToken);
            MergeInto(merged, cosmos);
        }

        // 2. Open Food Facts Brasil (gratuito, sem chave, alta taxa de acerto para mercado/alimentos/bebidas)
        if (!IsComplete(merged))
        {
            var off = await TryLookupOpenFactsAsync(
                "https://br.openfoodfacts.org",
                "Open Food Facts",
                normalized,
                cancellationToken);
            MergeInto(merged, off);
        }

        // 3. Se ainda faltar dados ou imagem, consulta bases complementares em paralelo (higiene, limpeza, pet e geral)
        if (!IsComplete(merged))
        {
            var parallelTasks = new[]
            {
                TryLookupOpenFactsAsync("https://world.openbeautyfacts.org", "Open Beauty Facts", normalized, cancellationToken),
                TryLookupOpenFactsAsync("https://world.openproductsfacts.org", "Open Products Facts", normalized, cancellationToken),
                TryLookupOpenFactsAsync("https://world.openpetfoodfacts.org", "Open Pet Food Facts", normalized, cancellationToken),
                TryLookupUpcItemDbAsync(normalized, cancellationToken)
            };

            var results = await Task.WhenAll(parallelTasks);
            foreach (var candidate in results)
            {
                MergeInto(merged, candidate);
                if (IsComplete(merged))
                {
                    break;
                }
            }
        }

        merged.Found = !string.IsNullOrWhiteSpace(merged.ProductName) ||
                       !string.IsNullOrWhiteSpace(merged.ProductImageUrl);

        Cache[normalized] = new CacheEntry(
            merged,
            DateTimeOffset.UtcNow.Add(merged.Found ? FoundCacheTtl : NotFoundCacheTtl));

        return merged;
    }

    internal static string NormalizeBarcode(string? raw)
        => new((raw ?? string.Empty).Where(char.IsDigit).ToArray());

    private static bool IsComplete(BarcodeLookupResponse item)
        => !string.IsNullOrWhiteSpace(item.ProductName) &&
           !string.IsNullOrWhiteSpace(item.ProductImageUrl) &&
           !string.IsNullOrWhiteSpace(item.ProductCategory);

    internal static void MergeInto(BarcodeLookupResponse target, BarcodeLookupResponse? candidate)
    {
        if (candidate is null || !candidate.Found) return;

        if (string.IsNullOrWhiteSpace(target.Source) && !string.IsNullOrWhiteSpace(candidate.Source))
        {
            target.Source = candidate.Source;
        }
        else if (!string.IsNullOrWhiteSpace(candidate.Source) &&
                 !target.Source.Contains(candidate.Source, StringComparison.OrdinalIgnoreCase) &&
                 (string.IsNullOrWhiteSpace(target.ProductImageUrl) && !string.IsNullOrWhiteSpace(candidate.ProductImageUrl)))
        {
            target.Source = $"{target.Source} + {candidate.Source}";
        }

        if (string.IsNullOrWhiteSpace(target.ProductName)) target.ProductName = candidate.ProductName;
        if (string.IsNullOrWhiteSpace(target.Brand)) target.Brand = candidate.Brand;
        if (string.IsNullOrWhiteSpace(target.ProductCategory)) target.ProductCategory = candidate.ProductCategory;
        if (string.IsNullOrWhiteSpace(target.ProductDescription)) target.ProductDescription = candidate.ProductDescription;
        if (string.IsNullOrWhiteSpace(target.ProductImageUrl)) target.ProductImageUrl = candidate.ProductImageUrl;
        if (target.SuggestedSalePrice is null && candidate.SuggestedSalePrice is > 0)
        {
            target.SuggestedSalePrice = candidate.SuggestedSalePrice;
        }
        if (target.SuggestedUnitType == "UN" && candidate.SuggestedUnitType == "KG")
        {
            target.SuggestedUnitType = "KG";
        }
    }

    private async Task<BarcodeLookupResponse?> TryLookupCosmosAsync(
        string barcode,
        string token,
        CancellationToken cancellationToken)
    {
        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(PerSourceTimeout);
            using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.cosmos.bluesoft.com.br/gtins/{barcode}.json");
            request.Headers.Add("X-Cosmos-Token", token);
            request.Headers.UserAgent.ParseAdd("HorusPDV/1.0");

            using var response = await httpClient.SendAsync(request, timeoutCts.Token);
            if (!response.IsSuccessStatusCode) return null;

            var json = await ReadJsonAsync(response, timeoutCts.Token);
            return ParseCosmosJson(barcode, json);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogDebug(ex, "Falha ao consultar Cosmos para código {Barcode}.", barcode);
            return null;
        }
    }

    private async Task<BarcodeLookupResponse?> TryLookupOpenFactsAsync(
        string baseUrl,
        string sourceName,
        string barcode,
        CancellationToken cancellationToken)
    {
        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(PerSourceTimeout);
            var url = $"{baseUrl}/api/v2/product/{barcode}.json?fields=product_name,product_name_pt,generic_name,generic_name_pt,brands,quantity,categories,categories_hierarchy,image_front_url,image_url,image_front_small_url";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.UserAgent.ParseAdd("HorusPDV/1.0 (https://github.com/JDaniloC/horus_pdv)");

            using var response = await httpClient.SendAsync(request, timeoutCts.Token);
            if (!response.IsSuccessStatusCode) return null;

            var json = await ReadJsonAsync(response, timeoutCts.Token);
            return ParseOpenFactsJson(barcode, sourceName, json);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogDebug(ex, "Falha ao consultar {Source} para código {Barcode}.", sourceName, barcode);
            return null;
        }
    }

    private async Task<BarcodeLookupResponse?> TryLookupUpcItemDbAsync(
        string barcode,
        CancellationToken cancellationToken)
    {
        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(PerSourceTimeout);
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"https://api.upcitemdb.com/prod/trial/lookup?upc={Uri.EscapeDataString(barcode)}");
            request.Headers.UserAgent.ParseAdd("HorusPDV/1.0");
            request.Headers.Add("Accept", "application/json");

            using var response = await httpClient.SendAsync(request, timeoutCts.Token);
            if (!response.IsSuccessStatusCode) return null;

            var json = await ReadJsonAsync(response, timeoutCts.Token);
            return ParseUpcItemDbJson(barcode, json);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogDebug(ex, "Falha ao consultar UPCitemdb para código {Barcode}.", barcode);
            return null;
        }
    }

    internal static BarcodeLookupResponse? ParseCosmosJson(string barcode, JsonNode? json)
    {
        if (json is null) return null;

        var description = Str(json, "description");
        var brand = Str(json["brand"], "name");
        var category = FirstNonEmpty(Str(json["gpc"], "description"), Str(json["ncm"], "description"));
        var imageUrl = SanitizeImageUrl(Str(json, "thumbnail"));
        decimal? avgPrice = null;
        if (json["avg_price"] is JsonValue priceValue &&
            priceValue.TryGetValue<decimal>(out var parsedPrice) &&
            parsedPrice > 0)
        {
            avgPrice = Math.Round(parsedPrice, 2, MidpointRounding.AwayFromZero);
        }

        if (string.IsNullOrWhiteSpace(description) && string.IsNullOrWhiteSpace(imageUrl))
        {
            return null;
        }

        return new BarcodeLookupResponse
        {
            Barcode = barcode,
            Found = true,
            Source = "Cosmos Bluesoft",
            ProductName = Truncate(description, 180),
            Brand = Truncate(brand, 80),
            ProductCategory = NormalizeCategory(category),
            ProductDescription = Truncate(BuildDescription(brand, string.Empty, Str(json["ncm"], "description")), 500),
            ProductImageUrl = imageUrl,
            SuggestedSalePrice = avgPrice
        };
    }

    internal static BarcodeLookupResponse? ParseOpenFactsJson(string barcode, string sourceName, JsonNode? json)
    {
        if (json is null) return null;

        var status = json["status"]?.GetValue<int?>() ?? 0;
        var product = json["product"];
        if (status != 1 || product is null)
        {
            return null;
        }

        var rawName = FirstNonEmpty(
            Str(product, "product_name_pt"),
            Str(product, "product_name"),
            Str(product, "generic_name_pt"),
            Str(product, "generic_name"));
        var brand = ExtractPrimaryBrand(Str(product, "brands"));
        var quantity = Str(product, "quantity");
        var generic = FirstNonEmpty(Str(product, "generic_name_pt"), Str(product, "generic_name"));
        var imageUrl = SanitizeImageUrl(FirstNonEmpty(
            Str(product, "image_front_url"),
            Str(product, "image_url"),
            Str(product, "image_front_small_url")));
        var category = ExtractOpenFactsCategory(product);

        var composedName = ComposeProductName(rawName, brand, quantity);
        if (string.IsNullOrWhiteSpace(composedName) && string.IsNullOrWhiteSpace(imageUrl))
        {
            return null;
        }

        return new BarcodeLookupResponse
        {
            Barcode = barcode,
            Found = true,
            Source = sourceName,
            ProductName = Truncate(composedName, 180),
            Brand = Truncate(brand, 80),
            ProductCategory = category,
            ProductDescription = Truncate(BuildDescription(brand, quantity, generic), 500),
            ProductImageUrl = imageUrl,
            SuggestedUnitType = "UN"
        };
    }

    internal static BarcodeLookupResponse? ParseUpcItemDbJson(string barcode, JsonNode? json)
    {
        if (json?["items"] is not JsonArray { Count: > 0 } items || items[0] is null)
        {
            return null;
        }

        var item = items[0]!;
        var title = Str(item, "title");
        var brand = Str(item, "brand");
        var description = Str(item, "description");
        var rawCategory = Str(item, "category");
        var imageUrl = string.Empty;
        if (item["images"] is JsonArray images)
        {
            foreach (var img in images)
            {
                var candidate = SanitizeImageUrl(img?.GetValue<string>());
                if (!string.IsNullOrWhiteSpace(candidate))
                {
                    imageUrl = candidate;
                    break;
                }
            }
        }

        if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(imageUrl))
        {
            return null;
        }

        var cleanCategory = rawCategory.Contains('>')
            ? rawCategory.Split('>').Last().Trim()
            : rawCategory;

        return new BarcodeLookupResponse
        {
            Barcode = barcode,
            Found = true,
            Source = "UPCitemdb",
            ProductName = Truncate(ComposeProductName(title, brand, string.Empty), 180),
            Brand = Truncate(brand, 80),
            ProductCategory = NormalizeCategory(cleanCategory),
            ProductDescription = Truncate(FirstNonEmpty(description, BuildDescription(brand, string.Empty, string.Empty)), 500),
            ProductImageUrl = imageUrl
        };
    }

    internal static string ComposeProductName(string rawName, string brand, string quantity)
    {
        var name = rawName.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            name = brand.Trim();
        }
        else if (!string.IsNullOrWhiteSpace(brand) &&
                 !name.Contains(brand, StringComparison.OrdinalIgnoreCase))
        {
            name = $"{name} {brand.Trim()}";
        }

        var normalizedQty = quantity.Trim();
        if (!string.IsNullOrWhiteSpace(name) &&
            !string.IsNullOrWhiteSpace(normalizedQty) &&
            !name.Contains(normalizedQty, StringComparison.OrdinalIgnoreCase))
        {
            name = $"{name} {normalizedQty}";
        }

        return name.Trim();
    }

    private static string BuildDescription(string brand, string quantity, string generic)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(generic)) parts.Add(generic.Trim());
        if (!string.IsNullOrWhiteSpace(brand)) parts.Add($"Marca: {brand.Trim()}");
        if (!string.IsNullOrWhiteSpace(quantity)) parts.Add($"Conteúdo: {quantity.Trim()}");
        return string.Join(" · ", parts);
    }

    private static string ExtractPrimaryBrand(string rawBrands)
    {
        if (string.IsNullOrWhiteSpace(rawBrands)) return string.Empty;
        return rawBrands
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault() ?? string.Empty;
    }

    private static string ExtractOpenFactsCategory(JsonNode product)
    {
        // Prioriza tags em português ou mapeadas no dicionário de categorias conhecidas.
        if (product["categories_hierarchy"] is JsonArray hierarchy)
        {
            var tags = hierarchy
                .Select(node => node?.GetValue<string>()?.Trim() ?? string.Empty)
                .Where(tag => tag.Length > 0)
                .ToList();

            var ptTag = tags.LastOrDefault(tag => tag.StartsWith("pt:", StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(ptTag))
            {
                return NormalizeCategory(ptTag[3..].Replace('-', ' '));
            }

            for (var i = tags.Count - 1; i >= 0; i -= 1)
            {
                var slug = tags[i].Contains(':') ? tags[i][(tags[i].IndexOf(':') + 1)..] : tags[i];
                if (CategoryTranslations.TryGetValue(slug, out var translated))
                {
                    return translated;
                }
            }
        }

        var categoriesText = Str(product, "categories");
        if (string.IsNullOrWhiteSpace(categoriesText)) return string.Empty;

        var firstReadable = categoriesText
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(item => item.Contains(':') ? item[(item.IndexOf(':') + 1)..] : item)
            .FirstOrDefault(item => !string.IsNullOrWhiteSpace(item));

        return NormalizeCategory(firstReadable ?? string.Empty);
    }

    private static string NormalizeCategory(string raw)
    {
        var trimmed = raw.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return string.Empty;

        var slugCandidate = trimmed.ToLowerInvariant().Replace(' ', '-');
        if (CategoryTranslations.TryGetValue(slugCandidate, out var translated))
        {
            return translated;
        }

        var textInfo = new CultureInfo("pt-BR").TextInfo;
        var titled = trimmed.Length > 1 && char.IsLower(trimmed[0])
            ? textInfo.ToTitleCase(trimmed.ToLower(new CultureInfo("pt-BR")))
            : trimmed;
        return Truncate(titled, 100);
    }

    private static string SanitizeImageUrl(string? raw)
    {
        var candidate = (raw ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(candidate)) return string.Empty;
        if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)) return string.Empty;
        return uri.Scheme is "https" or "http" ? uri.AbsoluteUri : string.Empty;
    }

    private static async Task<JsonNode?> ReadJsonAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var content = await response.Content.ReadAsStringAsync(ct);
        return string.IsNullOrWhiteSpace(content) ? null : JsonNode.Parse(content);
    }

    private static string Str(JsonNode? node, string property)
        => node?[property]?.GetValue<string>()?.Trim() ?? string.Empty;

    private static string FirstNonEmpty(params string[] values)
        => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength].TrimEnd();
}
