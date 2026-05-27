/**
 * Arquivo: API/NETCORE/Repositories/DatabaseAccess/HorusSecurityStore.cs
 * Objetivo: concentra comandos SQL de usuários, sessões, tentativas de login e tokens de recuperação.
 * Entradas esperadas: recebe conexão configurada, parâmetros normalizados e executa leitura/escrita no SQL Server.
 */
using HORUSPDV_API.Models.Requests;
using HORUSPDV_API.Repositories;
using HORUSPDV_API.Services.Security;
using Microsoft.Data.SqlClient;
using System.Security.Cryptography;
using System.Text;

namespace HORUSPDV_API.Repositories.DatabaseAccess;

public class HorusSecurityStore(Connection connection, HorusSecurityOptions securityOptions)
{
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan AttemptWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(10);
    private static readonly object AttemptSyncRoot = new();
    private static readonly Dictionary<string, LoginAttemptBucket> Attempts = new(StringComparer.OrdinalIgnoreCase);

    public List<SecurityUserDto> ListUsers(string companyId)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand(
            """
            SELECT Id, CompanyId, Cpf, Name, Email, Phone, Role, Status, CreatedAt, LastLoginAt, PasswordHash, MustChangePassword
            FROM Usuarios
            WHERE CompanyId = @CompanyId
            ORDER BY Name;
            """,
            db);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        using var reader = command.ExecuteReader();
        var rows = new List<SecurityUserDto>();
        while (reader.Read())
        {
            rows.Add(ToDto(ReadUser(reader)));
        }

        return rows;
    }

    public SecurityUserDto CreateUser(UsuarioRequest request, string companyId)
    {
        var user = MapRequest($"usr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", request, true);
        user.CompanyId = companyId;
        ValidateDuplicates(user, null, companyId);
        InsertUser(user);
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

        var companyId = $"emp-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var user = MapRequest($"usr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", new UsuarioRequest
        {
            Cpf = request.Cnpj,
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            Role = "administrador",
            Status = "ativo",
            Password = request.Password
        }, true);
        user.CompanyId = companyId;
        user.MustChangePassword = false;
        ValidateDuplicates(user, null, companyId);
        EnsureCompanyForPublicRegistration(companyId, request);
        InsertUser(user);
        return ToDto(user);
    }

    public SecurityUserDto? UpdateUser(string id, UsuarioRequest request, string companyId)
    {
        var current = FindUserById(id, companyId);
        if (current is null) return null;

        var updated = MapRequest(id, request, false);
        updated.CompanyId = companyId;
        ValidateDuplicates(updated, id, companyId);
        updated.PasswordHash = string.IsNullOrWhiteSpace(request.Password)
            ? current.PasswordHash
            : PasswordHasher.Hash(request.Password);
        updated.MustChangePassword = !string.IsNullOrWhiteSpace(request.Password) || current.MustChangePassword;
        UpdateUserRecord(updated);

        if (updated.Status == "inativo")
        {
            DeleteSessionsByUser(updated.Id);
        }

        return ToDto(updated);
    }

    public SecurityUserDto? UpdateStatus(string id, string status, string companyId)
    {
        var user = FindUserById(id, companyId);
        if (user is null) return null;

        user.Status = status == "inativo" ? "inativo" : "ativo";
        using var db = connection.OpenConnection();
        using var command = new SqlCommand("UPDATE Usuarios SET Status = @Status WHERE Id = @Id AND CompanyId = @CompanyId;", db);
        command.Parameters.AddWithValue("@Status", user.Status);
        command.Parameters.AddWithValue("@Id", user.Id);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.ExecuteNonQuery();

        if (user.Status == "inativo")
        {
            DeleteSessionsByUser(user.Id);
        }

        return ToDto(user);
    }

    public SecurityUserDto? UpdateOwnProfile(string userId, string name, string email, string phone)
    {
        var user = FindUserById(userId);
        if (user is null || user.Status != "ativo") return null;

        var request = new UsuarioRequest
        {
            CompanyId = user.CompanyId,
            Cpf = user.Cpf,
            Name = name,
            Email = email,
            Phone = phone,
            Role = user.Role,
            Status = user.Status,
            Password = string.Empty
        };
        var updated = MapRequest(user.Id, request, false);
        updated.CompanyId = user.CompanyId;
        updated.PasswordHash = user.PasswordHash;
        updated.CreatedAt = user.CreatedAt;
        updated.LastLoginAt = user.LastLoginAt;
        updated.MustChangePassword = user.MustChangePassword;
        ValidateDuplicates(updated, user.Id, user.CompanyId);
        UpdateUserRecord(updated);
        return ToDto(updated);
    }

    public ResetPasswordResult? ResetPassword(string id, string companyId)
    {
        var user = FindUserById(id, companyId);
        if (user is null) return null;

        var password = $"Tmp@{Random.Shared.Next(100000, 999999)}9";
        using var db = connection.OpenConnection();
        using var transaction = db.BeginTransaction();
        try
        {
            using var command = new SqlCommand(
                """
                UPDATE Usuarios
                   SET PasswordHash = @PasswordHash,
                       MustChangePassword = 1
                 WHERE Id = @Id;
                DELETE FROM Sessoes WHERE UserId = @Id;
                """,
                db,
                transaction);
            command.Parameters.AddWithValue("@PasswordHash", PasswordHasher.Hash(password));
            command.Parameters.AddWithValue("@Id", user.Id);
            command.ExecuteNonQuery();
            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }

        user.MustChangePassword = true;
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

            var user = FindUserByEmail(normalizedEmail);
            if (user is null || user.Status != "ativo" || !PasswordHasher.Verify(password, user.PasswordHash))
            {
                RegisterFailedAttempt(bucket, now);
                return LoginResult.Fail("E-mail ou senha inválidos.", bucket.LockedUntil);
            }

            Attempts.Remove(attemptKey);
            user.LastLoginAt = now.UtcDateTime.ToString("o");
            var session = CreateSession(user, ip, userAgent, now);

            using var db = connection.OpenConnection();
            using var transaction = db.BeginTransaction();
            try
            {
                using var updateUser = new SqlCommand(
                    "UPDATE Usuarios SET LastLoginAt = @LastLoginAt WHERE Id = @Id;",
                    db,
                    transaction);
                updateUser.Parameters.AddWithValue("@LastLoginAt", user.LastLoginAt);
                updateUser.Parameters.AddWithValue("@Id", user.Id);
                updateUser.ExecuteNonQuery();

                InsertSession(db, transaction, session);
                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }

            return LoginResult.Ok(ToDto(user), session);
        }
    }

    public SecurityUserDto? GetActiveUser(string id)
    {
        var user = FindUserById(id);
        return user is null || user.Status != "ativo" ? null : ToDto(user);
    }

    public List<SecuritySessionDto> ListSessions(string userId, string currentSessionId)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand(
            """
            SELECT Id, UserId, Device, Location, Ip, LastActive, Platform, CreatedAt
            FROM Sessoes
            WHERE UserId = @UserId
            ORDER BY CreatedAt DESC;
            """,
            db);
        command.Parameters.AddWithValue("@UserId", userId);
        using var reader = command.ExecuteReader();
        var rows = new List<SecuritySessionDto>();
        while (reader.Read())
        {
            rows.Add(ToSessionDto(ReadSession(reader), ReadString(reader, "Id") == currentSessionId));
        }

        return rows;
    }

    public bool TerminateSession(string userId, string id, string currentSessionId)
    {
        if (id == currentSessionId) return false;

        using var db = connection.OpenConnection();
        using var command = new SqlCommand("DELETE FROM Sessoes WHERE Id = @Id AND UserId = @UserId;", db);
        command.Parameters.AddWithValue("@Id", id);
        command.Parameters.AddWithValue("@UserId", userId);
        return command.ExecuteNonQuery() > 0;
    }

    public void TerminateOtherSessions(string userId, string currentSessionId)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand("DELETE FROM Sessoes WHERE UserId = @UserId AND Id <> @Id;", db);
        command.Parameters.AddWithValue("@UserId", userId);
        command.Parameters.AddWithValue("@Id", currentSessionId);
        command.ExecuteNonQuery();
    }

    public void TerminateCurrentSession(string currentSessionId)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand("DELETE FROM Sessoes WHERE Id = @Id;", db);
        command.Parameters.AddWithValue("@Id", currentSessionId);
        command.ExecuteNonQuery();
    }

    public bool ChangePassword(string userId, string currentPassword, string nextPassword)
    {
        if (nextPassword.Length < 8) throw new InvalidOperationException("A nova senha deve ter no minimo 8 caracteres.");

        var user = FindUserById(userId);
        if (user is null || user.Status != "ativo") return false;
        if (!PasswordHasher.Verify(currentPassword, user.PasswordHash)) return false;

        using var db = connection.OpenConnection();
        using var transaction = db.BeginTransaction();
        try
        {
            using var command = new SqlCommand(
                """
                UPDATE Usuarios
                   SET PasswordHash = @PasswordHash,
                       MustChangePassword = 0
                 WHERE Id = @Id;
                DELETE FROM Sessoes WHERE UserId = @Id;
                """,
                db,
                transaction);
            command.Parameters.AddWithValue("@PasswordHash", PasswordHasher.Hash(nextPassword));
            command.Parameters.AddWithValue("@Id", user.Id);
            command.ExecuteNonQuery();
            transaction.Commit();
            return true;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public bool IsSessionActive(string sessionId)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand("SELECT COUNT(1) FROM Sessoes WHERE Id = @Id;", db);
        command.Parameters.AddWithValue("@Id", sessionId);
        return Convert.ToInt32(command.ExecuteScalar()) > 0;
    }

    public PasswordResetRequestResult CreatePasswordResetToken(string cnpj, string email, string ip, string userAgent)
    {
        var normalizedCnpj = OnlyDigits(cnpj);
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddMinutes(securityOptions.PasswordResetTokenMinutes);
        var requestedDevice = BuildDeviceLabel(userAgent);

        using var db = connection.OpenConnection();
        using var transaction = db.BeginTransaction();
        try
        {
            using (var cleanup = new SqlCommand(
                       "DELETE FROM PasswordResetTokens WHERE ExpiresAt <= @RetentionCutoff;",
                       db,
                       transaction))
            {
                cleanup.Parameters.AddWithValue("@RetentionCutoff", now.AddDays(-7));
                cleanup.ExecuteNonQuery();
            }

            var user = FindUserForPasswordReset(db, transaction, normalizedCnpj, normalizedEmail);
            if (user is null)
            {
                transaction.Commit();
                return PasswordResetRequestResult.Create();
            }

            using (var deleteTokens = new SqlCommand(
                       """
                       UPDATE PasswordResetTokens
                          SET ConsumedAt = @Now,
                              UpdatedAt = @Now
                        WHERE UserId = @UserId
                          AND ConsumedAt IS NULL;
                       """,
                       db,
                       transaction))
            {
                deleteTokens.Parameters.AddWithValue("@UserId", user.Id);
                deleteTokens.Parameters.AddWithValue("@Now", now);
                deleteTokens.ExecuteNonQuery();
            }

            var token = GenerateSecureToken();
            var tokenHash = HashPasswordResetToken(token);
            using (var insert = new SqlCommand(
                       """
                       INSERT INTO PasswordResetTokens
                           (Id, UserId, Email, Cnpj, TokenHash, CreatedAt, RequestedAt, ExpiresAt, ConsumedAt,
                            RequestedIp, RequestedUserAgent, RequestedDevice, ResetIp, ResetUserAgent, ResetDevice, UpdatedAt)
                       VALUES
                           (@Id, @UserId, @Email, @Cnpj, @TokenHash, @CreatedAt, @RequestedAt, @ExpiresAt, NULL,
                            @RequestedIp, @RequestedUserAgent, @RequestedDevice, NULL, NULL, NULL, @UpdatedAt);
                       """,
                       db,
                       transaction))
            {
                insert.Parameters.AddWithValue("@Id", $"prt-{Guid.NewGuid():N}");
                insert.Parameters.AddWithValue("@UserId", user.Id);
                insert.Parameters.AddWithValue("@Email", user.Email);
                insert.Parameters.AddWithValue("@Cnpj", normalizedCnpj);
                insert.Parameters.AddWithValue("@TokenHash", tokenHash);
                insert.Parameters.AddWithValue("@CreatedAt", now);
                insert.Parameters.AddWithValue("@RequestedAt", now);
                insert.Parameters.AddWithValue("@ExpiresAt", expiresAt);
                insert.Parameters.AddWithValue("@RequestedIp", NullIfEmpty(ip));
                insert.Parameters.AddWithValue("@RequestedUserAgent", NullIfEmpty(userAgent));
                insert.Parameters.AddWithValue("@RequestedDevice", NullIfEmpty(requestedDevice));
                insert.Parameters.AddWithValue("@UpdatedAt", now);
                insert.ExecuteNonQuery();
            }

            transaction.Commit();
            return PasswordResetRequestResult.Create(MaskEmail(user.Email), token, expiresAt);
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public void ConsumePasswordResetToken(string token, string ip, string userAgent)
    {
        if (string.IsNullOrWhiteSpace(token)) return;

        var now = DateTimeOffset.UtcNow;
        using var db = connection.OpenConnection();
        using var command = new SqlCommand(
            """
            UPDATE PasswordResetTokens
               SET ConsumedAt = COALESCE(ConsumedAt, @Now),
                   ResetIp = @ResetIp,
                   ResetUserAgent = @ResetUserAgent,
                   ResetDevice = @ResetDevice,
                   UpdatedAt = @Now
             WHERE TokenHash = @TokenHash;
            """,
            db);
        command.Parameters.AddWithValue("@Now", now);
        command.Parameters.AddWithValue("@ResetIp", NullIfEmpty(ip));
        command.Parameters.AddWithValue("@ResetUserAgent", NullIfEmpty(userAgent));
        command.Parameters.AddWithValue("@ResetDevice", NullIfEmpty(BuildDeviceLabel(userAgent)));
        command.Parameters.AddWithValue("@TokenHash", HashPasswordResetToken(token.Trim()));
        command.ExecuteNonQuery();
    }

    public SecurityUserDto ResetPasswordWithToken(
        string token,
        string nextPassword,
        string confirmPassword,
        string ip = "",
        string userAgent = "")
    {
        if (string.IsNullOrWhiteSpace(token)) throw new InvalidOperationException("Token de redefinição inválido.");
        if (!nextPassword.Equals(confirmPassword, StringComparison.Ordinal)) throw new InvalidOperationException("A confirmação de senha não confere.");
        if (nextPassword.Length < 8) throw new InvalidOperationException("A nova senha deve ter no minimo 8 caracteres.");

        var now = DateTimeOffset.UtcNow;
        using var db = connection.OpenConnection();
        using var transaction = db.BeginTransaction();
        try
        {
            var resetToken = FindResetToken(db, transaction, token.Trim());
            if (resetToken is null || resetToken.ExpiresAt <= now)
            {
                throw new InvalidOperationException("Token de redefinição inválido ou expirado.");
            }

            var user = FindUserById(db, transaction, resetToken.UserId);
            if (user is null || user.Status != "ativo")
            {
                throw new InvalidOperationException("Usuário inativo ou inexistente.");
            }

            using var command = new SqlCommand(
                """
                UPDATE Usuarios
                   SET PasswordHash = @PasswordHash,
                       MustChangePassword = 0
                 WHERE Id = @UserId;
                UPDATE PasswordResetTokens
                   SET ConsumedAt = COALESCE(ConsumedAt, @Now),
                       ResetIp = @ResetIp,
                       ResetUserAgent = @ResetUserAgent,
                       ResetDevice = @ResetDevice,
                       UpdatedAt = @Now
                 WHERE UserId = @UserId;
                DELETE FROM Sessoes WHERE UserId = @UserId;
                """,
                db,
                transaction);
            command.Parameters.AddWithValue("@PasswordHash", PasswordHasher.Hash(nextPassword));
            command.Parameters.AddWithValue("@UserId", user.Id);
            command.Parameters.AddWithValue("@Now", now);
            command.Parameters.AddWithValue("@ResetIp", NullIfEmpty(ip));
            command.Parameters.AddWithValue("@ResetUserAgent", NullIfEmpty(userAgent));
            command.Parameters.AddWithValue("@ResetDevice", NullIfEmpty(BuildDeviceLabel(userAgent)));
            command.ExecuteNonQuery();
            transaction.Commit();
            user.MustChangePassword = false;
            return ToDto(user);
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
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

    private static SecuritySession CreateSession(SecurityUserRecord user, string ip, string userAgent, DateTimeOffset now)
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

    private static SecurityUserRecord MapRequest(string id, UsuarioRequest request, bool isCreate)
    {
        var documentDigits = OnlyDigits(request.Cpf);
        if (documentDigits.Length != 11 && documentDigits.Length != 14)
        {
            throw new InvalidOperationException("CPF/CNPJ invalido.");
        }

        if (string.IsNullOrWhiteSpace(request.Name)) throw new InvalidOperationException("Nome e obrigatorio.");
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@')) throw new InvalidOperationException("E-mail invalido.");
        if (isCreate && request.Password.Length < 8) throw new InvalidOperationException("Senha deve ter no minimo 8 caracteres.");

        return new SecurityUserRecord
        {
            Id = id,
            CompanyId = request.CompanyId,
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

    private void ValidateDuplicates(SecurityUserRecord user, string? currentId, string companyId)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand(
            """
            SELECT COUNT(1)
            FROM Usuarios
            WHERE Id <> @CurrentId
              AND CompanyId = @CompanyId
              AND (Cpf = @Cpf OR Email = @Email);
            """,
            db);
        command.Parameters.AddWithValue("@CurrentId", currentId ?? string.Empty);
        command.Parameters.AddWithValue("@CompanyId", companyId);
        command.Parameters.AddWithValue("@Cpf", user.Cpf);
        command.Parameters.AddWithValue("@Email", user.Email);

        if (Convert.ToInt32(command.ExecuteScalar()) > 0)
        {
            throw new InvalidOperationException("Já existe usuário com este CPF ou e-mail.");
        }
    }

    private void InsertUser(SecurityUserRecord user)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand(
            """
            INSERT INTO Usuarios (Id, CompanyId, Cpf, Name, Email, Phone, Role, Status, CreatedAt, LastLoginAt, PasswordHash, MustChangePassword)
            VALUES (@Id, @CompanyId, @Cpf, @Name, @Email, @Phone, @Role, @Status, @CreatedAt, @LastLoginAt, @PasswordHash, @MustChangePassword);
            """,
            db);
        AddUserParameters(command, user);
        command.ExecuteNonQuery();
    }

    private void EnsureCompanyForPublicRegistration(string companyId, AuthRegisterRequest request)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand(
            """
            IF NOT EXISTS (SELECT 1 FROM Empresas WHERE Id = @Id)
            BEGIN
                INSERT INTO Empresas
                    (Id, FantasyName, CorporateName, Cnpj, StateRegistration, Website, Email, SacPhone, Phone, Mobile,
                     Cep, Address, Number, Neighborhood, City, Uf, Complement, EmailSmtpEnabled, EmailSmtpHost,
                     EmailSmtpPort, EmailSmtpEnableSsl, EmailSmtpUser, EmailSmtpPassword, EmailSmtpFromEmail,
                     EmailSmtpFromName, EmailSmtpReplyTo)
                VALUES
                    (@Id, @FantasyName, @CorporateName, @Cnpj, N'', N'', @Email, N'', @Phone, @Phone,
                     N'', N'', N'', N'', N'', N'', N'', 0, N'smtp-mail.outlook.com',
                     587, 1, N'', N'', N'', @FantasyName, N'');
            END;
            """,
            db);
        command.Parameters.AddWithValue("@Id", companyId);
        command.Parameters.AddWithValue("@FantasyName", request.Name.Trim());
        command.Parameters.AddWithValue("@CorporateName", request.Name.Trim());
        command.Parameters.AddWithValue("@Cnpj", request.Cnpj.Trim());
        command.Parameters.AddWithValue("@Email", request.Email.Trim().ToLowerInvariant());
        command.Parameters.AddWithValue("@Phone", request.Phone.Trim());
        command.ExecuteNonQuery();
    }

    private void UpdateUserRecord(SecurityUserRecord user)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand(
            """
            UPDATE Usuarios
               SET Cpf = @Cpf,
                   CompanyId = @CompanyId,
                   Name = @Name,
                   Email = @Email,
                   Phone = @Phone,
                   Role = @Role,
                   Status = @Status,
                   LastLoginAt = @LastLoginAt,
                   PasswordHash = @PasswordHash,
                   MustChangePassword = @MustChangePassword
             WHERE Id = @Id AND CompanyId = @CompanyId;
            """,
            db);
        AddUserParameters(command, user);
        command.ExecuteNonQuery();
    }

    private SecurityUserRecord? FindUserById(string id)
    {
        using var db = connection.OpenConnection();
        return FindUserById(db, null, id);
    }

    private SecurityUserRecord? FindUserById(string id, string companyId)
    {
        using var db = connection.OpenConnection();
        var user = FindUserById(db, null, id);
        return user is not null && user.CompanyId == companyId ? user : null;
    }

    private SecurityUserRecord? FindUserByEmail(string email)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand(
            """
            SELECT Id, CompanyId, Cpf, Name, Email, Phone, Role, Status, CreatedAt, LastLoginAt, PasswordHash, MustChangePassword
            FROM Usuarios
            WHERE Email = @Email;
            """,
            db);
        command.Parameters.AddWithValue("@Email", email);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadUser(reader) : null;
    }

    private static SecurityUserRecord? FindUserById(SqlConnection db, SqlTransaction? transaction, string id)
    {
        using var command = new SqlCommand(
            """
            SELECT Id, CompanyId, Cpf, Name, Email, Phone, Role, Status, CreatedAt, LastLoginAt, PasswordHash, MustChangePassword
            FROM Usuarios
            WHERE Id = @Id;
            """,
            db,
            transaction);
        command.Parameters.AddWithValue("@Id", id);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadUser(reader) : null;
    }

    private static SecurityUserRecord? FindUserForPasswordReset(
        SqlConnection db,
        SqlTransaction transaction,
        string cnpj,
        string email)
    {
        using var command = new SqlCommand(
            """
            SELECT Id, CompanyId, Cpf, Name, Email, Phone, Role, Status, CreatedAt, LastLoginAt, PasswordHash, MustChangePassword
            FROM Usuarios
            WHERE REPLACE(REPLACE(REPLACE(REPLACE(Cpf, '.', ''), '/', ''), '-', ''), ' ', '') = @Cnpj
              AND Email = @Email
              AND Status = N'ativo';
            """,
            db,
            transaction);
        command.Parameters.AddWithValue("@Cnpj", cnpj);
        command.Parameters.AddWithValue("@Email", email);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadUser(reader) : null;
    }

    private PasswordResetTokenRecord? FindResetToken(SqlConnection db, SqlTransaction transaction, string token)
    {
        var tokenHash = HashPasswordResetToken(token);
        using var command = new SqlCommand(
            """
            SELECT Id, UserId, Email, Cnpj, TokenHash, CreatedAt, RequestedAt, ExpiresAt, ConsumedAt
            FROM PasswordResetTokens
            WHERE TokenHash = @TokenHash AND ConsumedAt IS NULL;
            """,
            db,
            transaction);
        command.Parameters.AddWithValue("@TokenHash", tokenHash);
        using var reader = command.ExecuteReader();
        return reader.Read()
            ? new PasswordResetTokenRecord(
                ReadString(reader, "Id"),
                ReadString(reader, "UserId"),
                ReadString(reader, "Email"),
                ReadString(reader, "Cnpj"),
                ReadString(reader, "TokenHash"),
                reader.GetDateTimeOffset(reader.GetOrdinal("CreatedAt")),
                reader.GetDateTimeOffset(reader.GetOrdinal("RequestedAt")),
                reader.GetDateTimeOffset(reader.GetOrdinal("ExpiresAt")))
            : null;
    }

    private static void InsertSession(SqlConnection db, SqlTransaction transaction, SecuritySession session)
    {
        using var command = new SqlCommand(
            """
            INSERT INTO Sessoes (Id, UserId, Device, Location, Ip, LastActive, Platform, CreatedAt)
            VALUES (@Id, @UserId, @Device, @Location, @Ip, @LastActive, @Platform, @CreatedAt);
            """,
            db,
            transaction);
        command.Parameters.AddWithValue("@Id", session.Id);
        command.Parameters.AddWithValue("@UserId", session.UserId);
        command.Parameters.AddWithValue("@Device", session.Device);
        command.Parameters.AddWithValue("@Location", session.Location);
        command.Parameters.AddWithValue("@Ip", session.Ip);
        command.Parameters.AddWithValue("@LastActive", session.LastActive);
        command.Parameters.AddWithValue("@Platform", session.Platform);
        command.Parameters.AddWithValue("@CreatedAt", session.CreatedAt);
        command.ExecuteNonQuery();
    }

    private void DeleteSessionsByUser(string userId)
    {
        using var db = connection.OpenConnection();
        using var command = new SqlCommand("DELETE FROM Sessoes WHERE UserId = @UserId;", db);
        command.Parameters.AddWithValue("@UserId", userId);
        command.ExecuteNonQuery();
    }

    private static void AddUserParameters(SqlCommand command, SecurityUserRecord user)
    {
        command.Parameters.AddWithValue("@Id", user.Id);
        command.Parameters.AddWithValue("@CompanyId", user.CompanyId);
        command.Parameters.AddWithValue("@Cpf", user.Cpf);
        command.Parameters.AddWithValue("@Name", user.Name);
        command.Parameters.AddWithValue("@Email", user.Email);
        command.Parameters.AddWithValue("@Phone", user.Phone);
        command.Parameters.AddWithValue("@Role", user.Role);
        command.Parameters.AddWithValue("@Status", user.Status);
        command.Parameters.AddWithValue("@CreatedAt", user.CreatedAt);
        command.Parameters.AddWithValue("@LastLoginAt", user.LastLoginAt);
        command.Parameters.AddWithValue("@PasswordHash", user.PasswordHash);
        command.Parameters.AddWithValue("@MustChangePassword", user.MustChangePassword);
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

    private string HashPasswordResetToken(string token)
    {
        var normalized = token.Trim();
        var payload = Encoding.UTF8.GetBytes($"{normalized}:{securityOptions.JwtSecret}");
        var hash = SHA256.HashData(payload);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static object NullIfEmpty(string value)
        => string.IsNullOrWhiteSpace(value) ? DBNull.Value : value.Trim();

    private static string MaskEmail(string email)
    {
        var parts = email.Split('@', 2);
        if (parts.Length != 2 || parts[0].Length == 0) return email;
        var prefix = parts[0].Length == 1 ? parts[0] : $"{parts[0][0]}***{parts[0][^1]}";
        return $"{prefix}@{parts[1]}";
    }

    private static SecurityUserRecord ReadUser(SqlDataReader reader) => new()
    {
        Id = ReadString(reader, "Id"),
        CompanyId = ReadString(reader, "CompanyId"),
        Cpf = ReadString(reader, "Cpf"),
        Name = ReadString(reader, "Name"),
        Email = ReadString(reader, "Email"),
        Phone = ReadString(reader, "Phone"),
        Role = ReadString(reader, "Role"),
        Status = ReadString(reader, "Status"),
        CreatedAt = ReadString(reader, "CreatedAt"),
        LastLoginAt = ReadString(reader, "LastLoginAt"),
        PasswordHash = ReadString(reader, "PasswordHash"),
        MustChangePassword = reader.GetBoolean(reader.GetOrdinal("MustChangePassword"))
    };

    private static SecuritySession ReadSession(SqlDataReader reader) => new()
    {
        Id = ReadString(reader, "Id"),
        UserId = ReadString(reader, "UserId"),
        Device = ReadString(reader, "Device"),
        Location = ReadString(reader, "Location"),
        Ip = ReadString(reader, "Ip"),
        LastActive = ReadString(reader, "LastActive"),
        Platform = ReadString(reader, "Platform"),
        CreatedAt = reader.GetDateTimeOffset(reader.GetOrdinal("CreatedAt"))
    };

    private static string ReadString(SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private static SecurityUserDto ToDto(SecurityUserRecord source) => new()
    {
        Id = source.Id,
        CompanyId = source.CompanyId,
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
    public string CompanyId { get; set; } = string.Empty;
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

internal sealed class SecurityUserRecord
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = "empresa-principal";
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

internal sealed record PasswordResetTokenRecord(
    string Id,
    string UserId,
    string Email,
    string Cnpj,
    string TokenHash,
    DateTimeOffset CreatedAt,
    DateTimeOffset RequestedAt,
    DateTimeOffset ExpiresAt);

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
