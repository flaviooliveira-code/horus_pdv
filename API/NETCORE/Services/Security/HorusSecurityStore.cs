using HORUSPDV_API.Data;
using HORUSPDV_API.Data.Entities;
using HORUSPDV_API.Models.Requests;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace HORUSPDV_API.Services.Security;

public class HorusSecurityStore(HorusDbContext db)
{
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan AttemptWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan PasswordResetExpiration = TimeSpan.FromMinutes(30);
    private static readonly object AttemptSyncRoot = new();
    private static readonly Dictionary<string, LoginAttemptBucket> Attempts = new(StringComparer.OrdinalIgnoreCase);

    public List<SecurityUserDto> ListUsers()
        => db.Usuarios.AsNoTracking().OrderBy(item => item.Name).Select(ToDto).ToList();

    public SecurityUserDto CreateUser(UsuarioRequest request)
    {
        var user = MapRequest($"usr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request, true);
        ValidateDuplicates(user, null);
        db.Usuarios.Add(user);
        db.SaveChanges();
        return ToDto(user);
    }

    public SecurityUserDto RegisterPublicUser(AuthRegisterRequest request)
    {
        if (!IsValidCnpj(request.Cnpj))
        {
            throw new InvalidOperationException("CNPJ invalido.");
        }

        if (!request.Password.Equals(request.ConfirmPassword, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("A confirmação de senha não confere.");
        }

        var user = MapRequest($"usr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", new UsuarioRequest
        {
            Cpf = request.Cnpj,
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            Role = "atendente",
            Status = "ativo",
            Password = request.Password
        }, true);
        user.MustChangePassword = false;
        ValidateDuplicates(user, null);
        db.Usuarios.Add(user);
        db.SaveChanges();
        return ToDto(user);
    }

    public SecurityUserDto? UpdateUser(string id, UsuarioRequest request)
    {
        var current = db.Usuarios.FirstOrDefault(item => item.Id == id);
        if (current is null) return null;

        var updated = MapRequest(id, request, false);
        ValidateDuplicates(updated, id);

        current.Cpf = updated.Cpf;
        current.Name = updated.Name;
        current.Email = updated.Email;
        current.Phone = updated.Phone;
        current.Role = updated.Role;
        current.Status = updated.Status;
        current.PasswordHash = string.IsNullOrWhiteSpace(request.Password)
            ? current.PasswordHash
            : PasswordHasher.Hash(request.Password);
        current.MustChangePassword = !string.IsNullOrWhiteSpace(request.Password) || current.MustChangePassword;
        if (current.Status == "inativo")
        {
            db.Sessoes.RemoveRange(db.Sessoes.Where(item => item.UserId == current.Id));
        }

        db.SaveChanges();
        return ToDto(current);
    }

    public SecurityUserDto? UpdateStatus(string id, string status)
    {
        var user = db.Usuarios.FirstOrDefault(item => item.Id == id);
        if (user is null) return null;

        user.Status = status == "inativo" ? "inativo" : "ativo";
        if (user.Status == "inativo")
        {
            db.Sessoes.RemoveRange(db.Sessoes.Where(item => item.UserId == user.Id));
        }

        db.SaveChanges();
        return ToDto(user);
    }

    public ResetPasswordResult? ResetPassword(string id)
    {
        var user = db.Usuarios.FirstOrDefault(item => item.Id == id);
        if (user is null) return null;

        var password = $"Tmp@{Random.Shared.Next(100000, 999999)}9";
        user.PasswordHash = PasswordHasher.Hash(password);
        user.MustChangePassword = true;
        db.Sessoes.RemoveRange(db.Sessoes.Where(item => item.UserId == user.Id));
        db.SaveChanges();
        return new ResetPasswordResult(ToDto(user), password);
    }

    public LoginResult Authenticate(string email, string password, string ip, string userAgent)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var now = DateTimeOffset.UtcNow;
        var attemptKey = $"{ip}|{normalizedEmail}";

        lock (AttemptSyncRoot)
        {
            var bucket = GetAttemptBucket(attemptKey, now);
            if (bucket.LockedUntil is not null && bucket.LockedUntil > now)
            {
                return LoginResult.Fail("Muitas tentativas inválidas. Aguarde alguns minutos para tentar novamente.", bucket.LockedUntil);
            }

            var user = db.Usuarios.FirstOrDefault(item => item.Email == normalizedEmail);
            if (user is null || user.Status != "ativo" || !PasswordHasher.Verify(password, user.PasswordHash))
            {
                RegisterFailedAttempt(bucket, now);
                return LoginResult.Fail("E-mail ou senha inválidos.", bucket.LockedUntil);
            }

            Attempts.Remove(attemptKey);
            user.LastLoginAt = now.UtcDateTime.ToString("o");
            var session = CreateSession(user, ip, userAgent, now);
            db.Sessoes.Add(session);
            db.SaveChanges();
            return LoginResult.Ok(ToDto(user), ToSession(session));
        }
    }

    public SecurityUserDto? GetActiveUser(string id)
    {
        var user = db.Usuarios.AsNoTracking().FirstOrDefault(item => item.Id == id && item.Status == "ativo");
        return user is null ? null : ToDto(user);
    }

    public List<SecuritySessionDto> ListSessions(string currentSessionId)
        => db.Sessoes.AsNoTracking()
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => ToSessionDto(item, item.Id == currentSessionId))
            .ToList();

    public bool TerminateSession(string id, string currentSessionId)
    {
        var session = db.Sessoes.FirstOrDefault(item => item.Id == id);
        if (session is null || session.Id == currentSessionId) return false;
        db.Sessoes.Remove(session);
        db.SaveChanges();
        return true;
    }

    public void TerminateOtherSessions(string currentSessionId)
    {
        db.Sessoes.RemoveRange(db.Sessoes.Where(item => item.Id != currentSessionId));
        db.SaveChanges();
    }

    public void TerminateCurrentSession(string currentSessionId)
    {
        db.Sessoes.RemoveRange(db.Sessoes.Where(item => item.Id == currentSessionId));
        db.SaveChanges();
    }

    public bool ChangePassword(string userId, string currentPassword, string nextPassword)
    {
        if (nextPassword.Length < 8) throw new InvalidOperationException("A nova senha deve ter no minimo 8 caracteres.");

        var user = db.Usuarios.FirstOrDefault(item => item.Id == userId && item.Status == "ativo");
        if (user is null) return false;
        if (!PasswordHasher.Verify(currentPassword, user.PasswordHash)) return false;

        user.PasswordHash = PasswordHasher.Hash(nextPassword);
        user.MustChangePassword = false;
        db.Sessoes.RemoveRange(db.Sessoes.Where(item => item.UserId == user.Id));
        db.SaveChanges();
        return true;
    }

    public bool IsSessionActive(string sessionId)
        => db.Sessoes.AsNoTracking().Any(item => item.Id == sessionId);

    public PasswordResetRequestResult CreatePasswordResetToken(string cnpj, string email)
    {
        var normalizedCnpj = OnlyDigits(cnpj);
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var now = DateTimeOffset.UtcNow;
        db.PasswordResetTokens.RemoveRange(db.PasswordResetTokens.Where(item => item.ExpiresAt <= now || item.ConsumedAt != null));

        var user = db.Usuarios.FirstOrDefault(item =>
            item.Cpf.Replace(".", "").Replace("/", "").Replace("-", "") == normalizedCnpj &&
            item.Email == normalizedEmail &&
            item.Status == "ativo");
        if (user is null)
        {
            db.SaveChanges();
            return PasswordResetRequestResult.Create();
        }

        db.PasswordResetTokens.RemoveRange(db.PasswordResetTokens.Where(item => item.UserId == user.Id));
        var token = GenerateSecureToken();
        var expiresAt = now.Add(PasswordResetExpiration);
        db.PasswordResetTokens.Add(new PasswordResetTokenEntity
        {
            Token = token,
            UserId = user.Id,
            Email = user.Email,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        db.Sessoes.RemoveRange(db.Sessoes.Where(item => item.UserId == user.Id));
        db.SaveChanges();
        return PasswordResetRequestResult.Create(MaskEmail(user.Email), token, expiresAt);
    }

    public SecurityUserDto ResetPasswordWithToken(string token, string nextPassword, string confirmPassword)
    {
        if (string.IsNullOrWhiteSpace(token)) throw new InvalidOperationException("Token de redefinição inválido.");
        if (!nextPassword.Equals(confirmPassword, StringComparison.Ordinal)) throw new InvalidOperationException("A confirmação de senha não confere.");
        if (nextPassword.Length < 8) throw new InvalidOperationException("A nova senha deve ter no minimo 8 caracteres.");

        var now = DateTimeOffset.UtcNow;
        var passwordToken = db.PasswordResetTokens.FirstOrDefault(item =>
            item.Token == token.Trim() &&
            item.ConsumedAt == null);
        if (passwordToken is null || passwordToken.ExpiresAt <= now)
        {
            throw new InvalidOperationException("Token de redefinição inválido ou expirado.");
        }

        var user = db.Usuarios.FirstOrDefault(item => item.Id == passwordToken.UserId && item.Status == "ativo");
        if (user is null)
        {
            throw new InvalidOperationException("Usuário inativo ou inexistente.");
        }

        user.PasswordHash = PasswordHasher.Hash(nextPassword);
        user.MustChangePassword = false;
        passwordToken.ConsumedAt = now;
        db.PasswordResetTokens.RemoveRange(db.PasswordResetTokens.Where(item => item.UserId == user.Id));
        db.Sessoes.RemoveRange(db.Sessoes.Where(item => item.UserId == user.Id));
        db.SaveChanges();
        return ToDto(user);
    }

    private LoginAttemptBucket GetAttemptBucket(string key, DateTimeOffset now)
    {
        if (!Attempts.TryGetValue(key, out var bucket) || now - bucket.FirstAttemptAt > AttemptWindow)
        {
            bucket = new LoginAttemptBucket { FirstAttemptAt = now };
            Attempts[key] = bucket;
        }

        return bucket;
    }

    private static void RegisterFailedAttempt(LoginAttemptBucket bucket, DateTimeOffset now)
    {
        bucket.Count += 1;
        bucket.LastAttemptAt = now;
        if (bucket.Count >= MaxFailedAttempts)
        {
            bucket.LockedUntil = now.Add(LockDuration);
        }
    }

    private static SecuritySessionEntity CreateSession(SecurityUserEntity user, string ip, string userAgent, DateTimeOffset now)
    {
        var platform = userAgent.Contains("Mobile", StringComparison.OrdinalIgnoreCase) ? "mobile" : "desktop";
        return new SecuritySessionEntity
        {
            Id = $"sess-{Guid.NewGuid():N}",
            UserId = user.Id,
            Device = BuildDeviceLabel(userAgent),
            Location = "Localização indisponível",
            Ip = ip,
            LastActive = "Agora mesmo",
            Platform = platform,
            CreatedAt = now
        };
    }

    private static string BuildDeviceLabel(string userAgent)
    {
        if (userAgent.Contains("Firefox", StringComparison.OrdinalIgnoreCase)) return "Navegador - Firefox";
        if (userAgent.Contains("Edg", StringComparison.OrdinalIgnoreCase)) return "Navegador - Edge";
        if (userAgent.Contains("Chrome", StringComparison.OrdinalIgnoreCase)) return "Navegador - Chrome";
        if (userAgent.Contains("Safari", StringComparison.OrdinalIgnoreCase)) return "Navegador - Safari";
        return "Dispositivo web";
    }

    private static SecurityUserEntity MapRequest(string id, UsuarioRequest request, bool isCreate)
    {
        var documentDigits = OnlyDigits(request.Cpf);
        if (documentDigits.Length != 11 && documentDigits.Length != 14)
        {
            throw new InvalidOperationException("CPF/CNPJ invalido.");
        }

        if (string.IsNullOrWhiteSpace(request.Name)) throw new InvalidOperationException("Nome e obrigatorio.");
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@')) throw new InvalidOperationException("E-mail invalido.");
        if (isCreate && request.Password.Length < 8) throw new InvalidOperationException("Senha deve ter no minimo 8 caracteres.");

        return new SecurityUserEntity
        {
            Id = id,
            Cpf = request.Cpf.Trim(),
            Name = request.Name.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Phone = request.Phone.Trim(),
            Role = string.IsNullOrWhiteSpace(request.Role) ? "atendente" : request.Role.Trim(),
            Status = request.Status == "inativo" ? "inativo" : "ativo",
            CreatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            LastLoginAt = "-",
            PasswordHash = string.IsNullOrWhiteSpace(request.Password) ? string.Empty : PasswordHasher.Hash(request.Password),
            MustChangePassword = isCreate || !string.IsNullOrWhiteSpace(request.Password)
        };
    }

    private void ValidateDuplicates(SecurityUserEntity user, string? currentId)
    {
        if (db.Usuarios.Any(item => item.Id != currentId && item.Cpf == user.Cpf))
        {
            throw new InvalidOperationException("Ja existe usuario com este CPF.");
        }

        if (db.Usuarios.Any(item => item.Id != currentId && item.Email == user.Email))
        {
            throw new InvalidOperationException("Ja existe usuario com este e-mail.");
        }
    }

    private static string OnlyDigits(string value) => new(value.Where(char.IsDigit).ToArray());

    public static bool IsValidCnpj(string rawCnpj)
    {
        var cnpj = OnlyDigits(rawCnpj);
        if (cnpj.Length != 14 || cnpj.All(digit => digit == cnpj[0])) return false;

        static int CalcDigit(string baseValue, int[] factors)
        {
            var sum = 0;
            for (var index = 0; index < factors.Length; index += 1)
            {
                sum += (baseValue[index] - '0') * factors[index];
            }

            var remainder = sum % 11;
            return remainder < 2 ? 0 : 11 - remainder;
        }

        var base12 = cnpj[..12];
        var firstDigit = CalcDigit(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
        var secondDigit = CalcDigit($"{base12}{firstDigit}", [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
        return cnpj.EndsWith($"{firstDigit}{secondDigit}", StringComparison.Ordinal);
    }

    private static string GenerateSecureToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-", StringComparison.Ordinal)
            .Replace("/", "_", StringComparison.Ordinal)
            .TrimEnd('=');
    }

    private static string MaskEmail(string email)
    {
        var parts = email.Split('@', 2);
        if (parts.Length != 2 || parts[0].Length == 0) return email;
        var prefix = parts[0].Length == 1 ? parts[0] : $"{parts[0][0]}***{parts[0][^1]}";
        return $"{prefix}@{parts[1]}";
    }

    private static SecurityUserDto ToDto(SecurityUserEntity source) => new()
    {
        Id = source.Id,
        Cpf = source.Cpf,
        Name = source.Name,
        Email = source.Email,
        Phone = source.Phone,
        Role = source.Role,
        Status = source.Status,
        CreatedAt = source.CreatedAt,
        LastLoginAt = source.LastLoginAt,
        MustChangePassword = source.MustChangePassword
    };

    private static SecuritySession ToSession(SecuritySessionEntity source) => new()
    {
        Id = source.Id,
        UserId = source.UserId,
        Device = source.Device,
        Location = source.Location,
        Ip = source.Ip,
        LastActive = source.LastActive,
        Platform = source.Platform,
        CreatedAt = source.CreatedAt
    };

    private static SecuritySessionDto ToSessionDto(SecuritySessionEntity source, bool current) => new()
    {
        Id = source.Id,
        Device = source.Device,
        Location = source.Location,
        Ip = source.Ip,
        LastActive = current ? "Agora mesmo" : source.LastActive,
        Current = current,
        Platform = source.Platform
    };
}

public class SecurityUserDto
{
    public string Id { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string LastLoginAt { get; set; } = string.Empty;
    public bool MustChangePassword { get; set; }
}

public class SecuritySessionDto
{
    public string Id { get; set; } = string.Empty;
    public string Device { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Ip { get; set; } = string.Empty;
    public string LastActive { get; set; } = string.Empty;
    public bool Current { get; set; }
    public string Platform { get; set; } = "desktop";
}

public record ResetPasswordResult(SecurityUserDto User, string Password);
public record PasswordResetRequestResult(bool Accepted, string? MaskedEmail, string? ResetToken, DateTimeOffset? ExpiresAt)
{
    public static PasswordResetRequestResult Create(string? maskedEmail = null, string? resetToken = null, DateTimeOffset? expiresAt = null)
        => new(true, maskedEmail, resetToken, expiresAt);
}

public record LoginResult(bool Success, string Message, SecurityUserDto? User, SecuritySession? Session, DateTimeOffset? LockedUntil)
{
    public static LoginResult Ok(SecurityUserDto user, SecuritySession session) => new(true, "Login realizado com sucesso.", user, session, null);
    public static LoginResult Fail(string message, DateTimeOffset? lockedUntil = null) => new(false, message, null, null, lockedUntil);
}

public class SecuritySession
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Device { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Ip { get; set; } = string.Empty;
    public string LastActive { get; set; } = string.Empty;
    public string Platform { get; set; } = "desktop";
    public DateTimeOffset CreatedAt { get; set; }
}

internal class LoginAttemptBucket
{
    public int Count { get; set; }
    public DateTimeOffset FirstAttemptAt { get; set; }
    public DateTimeOffset LastAttemptAt { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
}

internal static class PasswordHasher
{
    private const int Iterations = 100_000;
    private const int SaltSize = 16;
    private const int KeySize = 32;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeySize);
        return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(key)}";
    }

    public static bool Verify(string password, string hash)
    {
        var parts = hash.Split('.');
        if (parts.Length != 3) return false;
        if (!int.TryParse(parts[0], out var iterations)) return false;

        var salt = Convert.FromBase64String(parts[1]);
        var expectedKey = Convert.FromBase64String(parts[2]);
        var actualKey = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expectedKey.Length);
        return CryptographicOperations.FixedTimeEquals(actualKey, expectedKey);
    }
}
