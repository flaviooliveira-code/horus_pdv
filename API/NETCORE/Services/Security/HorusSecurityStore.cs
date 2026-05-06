using HORUSPDV_API.Models.Requests;
using System.Security.Cryptography;

namespace HORUSPDV_API.Services.Security;

public class HorusSecurityStore
{
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan AttemptWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(10);
    private readonly object _syncRoot = new();
    private readonly List<SecurityUser> _users = [];
    private readonly List<SecuritySession> _sessions = [];
    private readonly Dictionary<string, LoginAttemptBucket> _attempts = new(StringComparer.OrdinalIgnoreCase);

    public HorusSecurityStore()
    {
        _users.Add(CreateSeedUser("usr-001", "123.456.789-01", "Flávio Oliveira", "flavio@hpdv.com.br", "(11) 98888-1111", "administrador", "ativo", "2026-02-10", "Admin@1234", false));
        _users.Add(CreateSeedUser("usr-002", "234.567.890-12", "Maria Santos", "maria@hpdv.com.br", "(11) 97777-2222", "gerente", "ativo", "2026-02-15", "Gerente@1234", false));
        _users.Add(CreateSeedUser("usr-003", "345.678.901-23", "João Costa", "joao@hpdv.com.br", "(11) 96666-3333", "atendente", "inativo", "2026-03-01", "Atendente@1234", true));
    }

    public List<SecurityUserDto> ListUsers()
    {
        lock (_syncRoot)
        {
            return _users.Select(ToDto).ToList();
        }
    }

    public SecurityUserDto CreateUser(UsuarioRequest request)
    {
        lock (_syncRoot)
        {
            var user = MapRequest($"usr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request, true);
            ValidateDuplicates(user, null);
            _users.Insert(0, user);
            return ToDto(user);
        }
    }

    public SecurityUserDto? UpdateUser(string id, UsuarioRequest request)
    {
        lock (_syncRoot)
        {
            var index = _users.FindIndex(item => item.Id == id);
            if (index < 0) return null;

            var current = _users[index];
            var updated = MapRequest(id, request, false);
            updated.CreatedAt = current.CreatedAt;
            updated.LastLoginAt = current.LastLoginAt;
            updated.PasswordHash = string.IsNullOrWhiteSpace(request.Password)
                ? current.PasswordHash
                : PasswordHasher.Hash(request.Password);
            updated.MustChangePassword = !string.IsNullOrWhiteSpace(request.Password) || current.MustChangePassword;
            ValidateDuplicates(updated, id);
            _users[index] = updated;
            return ToDto(updated);
        }
    }

    public SecurityUserDto? UpdateStatus(string id, string status)
    {
        lock (_syncRoot)
        {
            var user = _users.FirstOrDefault(item => item.Id == id);
            if (user is null) return null;

            user.Status = status == "inativo" ? "inativo" : "ativo";
            if (user.Status == "inativo")
            {
                _sessions.RemoveAll(item => item.UserId == user.Id);
            }

            return ToDto(user);
        }
    }

    public ResetPasswordResult? ResetPassword(string id)
    {
        lock (_syncRoot)
        {
            var user = _users.FirstOrDefault(item => item.Id == id);
            if (user is null) return null;

            var password = $"Tmp@{Random.Shared.Next(100000, 999999)}9";
            user.PasswordHash = PasswordHasher.Hash(password);
            user.MustChangePassword = true;
            _sessions.RemoveAll(item => item.UserId == user.Id);
            return new ResetPasswordResult(ToDto(user), password);
        }
    }

    public LoginResult Authenticate(string email, string password, string ip, string userAgent)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var now = DateTimeOffset.UtcNow;
        var attemptKey = $"{ip}|{normalizedEmail}";

        lock (_syncRoot)
        {
            var bucket = GetAttemptBucket(attemptKey, now);
            if (bucket.LockedUntil is not null && bucket.LockedUntil > now)
            {
                return LoginResult.Fail("Muitas tentativas inválidas. Aguarde alguns minutos para tentar novamente.", bucket.LockedUntil);
            }

            var user = _users.FirstOrDefault(item => item.Email.Equals(normalizedEmail, StringComparison.OrdinalIgnoreCase));
            if (user is null || user.Status != "ativo" || !PasswordHasher.Verify(password, user.PasswordHash))
            {
                RegisterFailedAttempt(bucket, now);
                return LoginResult.Fail("E-mail ou senha inválidos.", bucket.LockedUntil);
            }

            _attempts.Remove(attemptKey);
            user.LastLoginAt = now.UtcDateTime.ToString("o");
            var session = CreateSession(user, ip, userAgent, now);
            _sessions.Insert(0, session);

            return LoginResult.Ok(ToDto(user), session);
        }
    }

    public SecurityUserDto? GetActiveUser(string id)
    {
        lock (_syncRoot)
        {
            var user = _users.FirstOrDefault(item => item.Id == id && item.Status == "ativo");
            return user is null ? null : ToDto(user);
        }
    }

    public List<SecuritySessionDto> ListSessions(string currentSessionId)
    {
        lock (_syncRoot)
        {
            return _sessions.Select(item => ToSessionDto(item, item.Id == currentSessionId)).ToList();
        }
    }

    public bool TerminateSession(string id, string currentSessionId)
    {
        lock (_syncRoot)
        {
            var session = _sessions.FirstOrDefault(item => item.Id == id);
            if (session is null || session.Id == currentSessionId) return false;
            _sessions.Remove(session);
            return true;
        }
    }

    public void TerminateOtherSessions(string currentSessionId)
    {
        lock (_syncRoot)
        {
            _sessions.RemoveAll(item => item.Id != currentSessionId);
        }
    }

    public void TerminateCurrentSession(string currentSessionId)
    {
        lock (_syncRoot)
        {
            _sessions.RemoveAll(item => item.Id == currentSessionId);
        }
    }

    public bool ChangePassword(string userId, string currentPassword, string nextPassword)
    {
        if (nextPassword.Length < 8) throw new InvalidOperationException("A nova senha deve ter no minimo 8 caracteres.");

        lock (_syncRoot)
        {
            var user = _users.FirstOrDefault(item => item.Id == userId && item.Status == "ativo");
            if (user is null) return false;
            if (!PasswordHasher.Verify(currentPassword, user.PasswordHash)) return false;

            user.PasswordHash = PasswordHasher.Hash(nextPassword);
            user.MustChangePassword = false;
            _sessions.RemoveAll(item => item.UserId == user.Id);
            return true;
        }
    }

    public bool IsSessionActive(string sessionId)
    {
        lock (_syncRoot)
        {
            return _sessions.Any(item => item.Id == sessionId);
        }
    }

    private LoginAttemptBucket GetAttemptBucket(string key, DateTimeOffset now)
    {
        if (!_attempts.TryGetValue(key, out var bucket) || now - bucket.FirstAttemptAt > AttemptWindow)
        {
            bucket = new LoginAttemptBucket { FirstAttemptAt = now };
            _attempts[key] = bucket;
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

    private static SecuritySession CreateSession(SecurityUser user, string ip, string userAgent, DateTimeOffset now)
    {
        var platform = userAgent.Contains("Mobile", StringComparison.OrdinalIgnoreCase) ? "mobile" : "desktop";
        return new SecuritySession
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

    private SecurityUser MapRequest(string id, UsuarioRequest request, bool isCreate)
    {
        if (request.Cpf.Count(char.IsDigit) != 11) throw new InvalidOperationException("CPF invalido.");
        if (string.IsNullOrWhiteSpace(request.Name)) throw new InvalidOperationException("Nome e obrigatorio.");
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@')) throw new InvalidOperationException("E-mail invalido.");
        if (isCreate && request.Password.Length < 8) throw new InvalidOperationException("Senha deve ter no minimo 8 caracteres.");

        return new SecurityUser
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

    private void ValidateDuplicates(SecurityUser user, string? currentId)
    {
        if (_users.Any(item => item.Id != currentId && OnlyDigits(item.Cpf) == OnlyDigits(user.Cpf)))
        {
            throw new InvalidOperationException("Ja existe usuario com este CPF.");
        }

        if (_users.Any(item => item.Id != currentId && item.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Ja existe usuario com este e-mail.");
        }
    }

    private static SecurityUser CreateSeedUser(string id, string cpf, string name, string email, string phone, string role, string status, string createdAt, string password, bool mustChangePassword)
        => new()
        {
            Id = id,
            Cpf = cpf,
            Name = name,
            Email = email,
            Phone = phone,
            Role = role,
            Status = status,
            CreatedAt = createdAt,
            LastLoginAt = "-",
            PasswordHash = PasswordHasher.Hash(password),
            MustChangePassword = mustChangePassword
        };

    private static string OnlyDigits(string value) => new(value.Where(char.IsDigit).ToArray());

    private static SecurityUserDto ToDto(SecurityUser source) => new()
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

    private static SecuritySessionDto ToSessionDto(SecuritySession source, bool current) => new()
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

internal class SecurityUser
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
    public string PasswordHash { get; set; } = string.Empty;
    public bool MustChangePassword { get; set; }
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
