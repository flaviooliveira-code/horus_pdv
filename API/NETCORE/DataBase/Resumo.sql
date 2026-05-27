IF DB_ID(N'HorusPdv') IS NULL
BEGIN
    CREATE DATABASE HorusPdv;
END;
GO

USE HorusPdv;
GO

SET NOCOUNT ON;

IF OBJECT_ID(N'Fornecedores', N'U') IS NULL
BEGIN
    CREATE TABLE Fornecedores
    (
        Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Fornecedores PRIMARY KEY,
        CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Fornecedores_CompanyId DEFAULT N'empresa-principal',
        CompanyName NVARCHAR(180) NOT NULL CONSTRAINT DF_Fornecedores_CompanyName DEFAULT N'',
        FantasyName NVARCHAR(180) NOT NULL CONSTRAINT DF_Fornecedores_FantasyName DEFAULT N'',
        Cnpj NVARCHAR(30) NOT NULL CONSTRAINT DF_Fornecedores_Cnpj DEFAULT N'',
        Cep NVARCHAR(20) NOT NULL CONSTRAINT DF_Fornecedores_Cep DEFAULT N'',
        City NVARCHAR(120) NOT NULL CONSTRAINT DF_Fornecedores_City DEFAULT N'',
        State NVARCHAR(2) NOT NULL CONSTRAINT DF_Fornecedores_State DEFAULT N'',
        Address NVARCHAR(180) NOT NULL CONSTRAINT DF_Fornecedores_Address DEFAULT N'',
        Neighborhood NVARCHAR(120) NOT NULL CONSTRAINT DF_Fornecedores_Neighborhood DEFAULT N'',
        StreetComplement NVARCHAR(180) NOT NULL CONSTRAINT DF_Fornecedores_StreetComplement DEFAULT N'',
        Number NVARCHAR(30) NOT NULL CONSTRAINT DF_Fornecedores_Number DEFAULT N'',
        ReferencePoint NVARCHAR(180) NOT NULL CONSTRAINT DF_Fornecedores_ReferencePoint DEFAULT N'',
        Telephone NVARCHAR(30) NOT NULL CONSTRAINT DF_Fornecedores_Telephone DEFAULT N'',
        Cellphone NVARCHAR(30) NOT NULL CONSTRAINT DF_Fornecedores_Cellphone DEFAULT N'',
        Email NVARCHAR(180) NOT NULL CONSTRAINT DF_Fornecedores_Email DEFAULT N'',
        CONSTRAINT UQ_Fornecedores_Company_Cnpj UNIQUE (CompanyId, Cnpj)
    );
END;

IF COL_LENGTH(N'Fornecedores', N'CompanyId') IS NULL
BEGIN
    ALTER TABLE Fornecedores ADD CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Fornecedores_CompanyId DEFAULT N'empresa-principal';
END;

IF OBJECT_ID(N'Produtos', N'U') IS NULL
BEGIN
    CREATE TABLE Produtos
    (
        Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Produtos PRIMARY KEY,
        CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Produtos_CompanyId DEFAULT N'empresa-principal',
        ProductImageUrl NVARCHAR(500) NOT NULL CONSTRAINT DF_Produtos_ProductImageUrl DEFAULT N'',
        ProductImageName NVARCHAR(180) NOT NULL CONSTRAINT DF_Produtos_ProductImageName DEFAULT N'',
        ProductName NVARCHAR(180) NOT NULL CONSTRAINT DF_Produtos_ProductName DEFAULT N'',
        ProductCode NVARCHAR(80) NOT NULL,
        ProductSupplier NVARCHAR(180) NOT NULL CONSTRAINT DF_Produtos_ProductSupplier DEFAULT N'',
        SupplierId NVARCHAR(40) NULL,
        ProductDescription NVARCHAR(500) NOT NULL CONSTRAINT DF_Produtos_ProductDescription DEFAULT N'',
        ProductQnt NVARCHAR(30) NOT NULL CONSTRAINT DF_Produtos_ProductQnt DEFAULT N'0',
        ProductUnitPrice NVARCHAR(30) NOT NULL CONSTRAINT DF_Produtos_ProductUnitPrice DEFAULT N'0,00',
        ProductSalePrice NVARCHAR(30) NOT NULL CONSTRAINT DF_Produtos_ProductSalePrice DEFAULT N'0,00',
        TotalPriceOnProduct NVARCHAR(30) NOT NULL CONSTRAINT DF_Produtos_TotalPriceOnProduct DEFAULT N'0,00',
        CONSTRAINT UQ_Produtos_Company_ProductCode UNIQUE (CompanyId, ProductCode),
        CONSTRAINT FK_Produtos_Fornecedores FOREIGN KEY (SupplierId) REFERENCES Fornecedores (Id) ON DELETE SET NULL
    );
END;

IF COL_LENGTH(N'Produtos', N'CompanyId') IS NULL
BEGIN
    ALTER TABLE Produtos ADD CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Produtos_CompanyId DEFAULT N'empresa-principal';
END;

IF OBJECT_ID(N'Clientes', N'U') IS NULL
BEGIN
    CREATE TABLE Clientes
    (
        Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Clientes PRIMARY KEY,
        CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Clientes_CompanyId DEFAULT N'empresa-principal',
        CustomerName NVARCHAR(180) NOT NULL CONSTRAINT DF_Clientes_CustomerName DEFAULT N'',
        Document NVARCHAR(30) NOT NULL CONSTRAINT DF_Clientes_Document DEFAULT N'',
        BirthDate NVARCHAR(20) NOT NULL CONSTRAINT DF_Clientes_BirthDate DEFAULT N'',
        Age NVARCHAR(10) NOT NULL CONSTRAINT DF_Clientes_Age DEFAULT N'',
        Cep NVARCHAR(20) NOT NULL CONSTRAINT DF_Clientes_Cep DEFAULT N'',
        City NVARCHAR(120) NOT NULL CONSTRAINT DF_Clientes_City DEFAULT N'',
        State NVARCHAR(2) NOT NULL CONSTRAINT DF_Clientes_State DEFAULT N'',
        Address NVARCHAR(180) NOT NULL CONSTRAINT DF_Clientes_Address DEFAULT N'',
        Neighborhood NVARCHAR(120) NOT NULL CONSTRAINT DF_Clientes_Neighborhood DEFAULT N'',
        StreetComplement NVARCHAR(180) NOT NULL CONSTRAINT DF_Clientes_StreetComplement DEFAULT N'',
        Number NVARCHAR(30) NOT NULL CONSTRAINT DF_Clientes_Number DEFAULT N'',
        ReferencePoint NVARCHAR(180) NOT NULL CONSTRAINT DF_Clientes_ReferencePoint DEFAULT N'',
        Telephone NVARCHAR(30) NOT NULL CONSTRAINT DF_Clientes_Telephone DEFAULT N'',
        Cellphone NVARCHAR(30) NOT NULL CONSTRAINT DF_Clientes_Cellphone DEFAULT N'',
        Email NVARCHAR(180) NOT NULL CONSTRAINT DF_Clientes_Email DEFAULT N'',
        CONSTRAINT UQ_Clientes_Company_Document UNIQUE (CompanyId, Document)
    );
END;

IF COL_LENGTH(N'Clientes', N'CompanyId') IS NULL
BEGIN
    ALTER TABLE Clientes ADD CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Clientes_CompanyId DEFAULT N'empresa-principal';
END;

IF OBJECT_ID(N'Empresas', N'U') IS NULL
BEGIN
    CREATE TABLE Empresas
    (
        Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Empresas PRIMARY KEY,
        FantasyName NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_FantasyName DEFAULT N'',
        CorporateName NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_CorporateName DEFAULT N'',
        Cnpj NVARCHAR(30) NOT NULL CONSTRAINT DF_Empresas_Cnpj DEFAULT N'',
        StateRegistration NVARCHAR(60) NOT NULL CONSTRAINT DF_Empresas_StateRegistration DEFAULT N'',
        Website NVARCHAR(250) NOT NULL CONSTRAINT DF_Empresas_Website DEFAULT N'',
        Email NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_Email DEFAULT N'',
        SacPhone NVARCHAR(30) NOT NULL CONSTRAINT DF_Empresas_SacPhone DEFAULT N'',
        Phone NVARCHAR(30) NOT NULL CONSTRAINT DF_Empresas_Phone DEFAULT N'',
        Mobile NVARCHAR(30) NOT NULL CONSTRAINT DF_Empresas_Mobile DEFAULT N'',
        Cep NVARCHAR(20) NOT NULL CONSTRAINT DF_Empresas_Cep DEFAULT N'',
        Address NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_Address DEFAULT N'',
        Number NVARCHAR(30) NOT NULL CONSTRAINT DF_Empresas_Number DEFAULT N'',
        Neighborhood NVARCHAR(120) NOT NULL CONSTRAINT DF_Empresas_Neighborhood DEFAULT N'',
        City NVARCHAR(120) NOT NULL CONSTRAINT DF_Empresas_City DEFAULT N'',
        Uf NVARCHAR(2) NOT NULL CONSTRAINT DF_Empresas_Uf DEFAULT N'',
        Complement NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_Complement DEFAULT N'',
        EmailSmtpEnabled BIT NOT NULL CONSTRAINT DF_Empresas_EmailSmtpEnabled DEFAULT 0,
        EmailSmtpHost NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpHost DEFAULT N'smtp-mail.outlook.com',
        EmailSmtpPort INT NOT NULL CONSTRAINT DF_Empresas_EmailSmtpPort DEFAULT 587,
        EmailSmtpEnableSsl BIT NOT NULL CONSTRAINT DF_Empresas_EmailSmtpEnableSsl DEFAULT 1,
        EmailSmtpUser NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpUser DEFAULT N'',
        EmailSmtpPassword NVARCHAR(500) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpPassword DEFAULT N'',
        EmailSmtpFromEmail NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpFromEmail DEFAULT N'',
        EmailSmtpFromName NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpFromName DEFAULT N'',
        EmailSmtpReplyTo NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpReplyTo DEFAULT N''
    );
END;

IF COL_LENGTH(N'Empresas', N'EmailSmtpEnabled') IS NULL
BEGIN
    ALTER TABLE Empresas ADD EmailSmtpEnabled BIT NOT NULL CONSTRAINT DF_Empresas_EmailSmtpEnabled DEFAULT 0;
    ALTER TABLE Empresas ADD EmailSmtpHost NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpHost DEFAULT N'smtp-mail.outlook.com';
    ALTER TABLE Empresas ADD EmailSmtpPort INT NOT NULL CONSTRAINT DF_Empresas_EmailSmtpPort DEFAULT 587;
    ALTER TABLE Empresas ADD EmailSmtpEnableSsl BIT NOT NULL CONSTRAINT DF_Empresas_EmailSmtpEnableSsl DEFAULT 1;
    ALTER TABLE Empresas ADD EmailSmtpUser NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpUser DEFAULT N'';
    ALTER TABLE Empresas ADD EmailSmtpPassword NVARCHAR(500) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpPassword DEFAULT N'';
    ALTER TABLE Empresas ADD EmailSmtpFromEmail NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpFromEmail DEFAULT N'';
    ALTER TABLE Empresas ADD EmailSmtpFromName NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpFromName DEFAULT N'';
    ALTER TABLE Empresas ADD EmailSmtpReplyTo NVARCHAR(180) NOT NULL CONSTRAINT DF_Empresas_EmailSmtpReplyTo DEFAULT N'';
END;

GO

USE HorusPdv;
GO

IF OBJECT_ID(N'Usuarios', N'U') IS NULL
BEGIN
    CREATE TABLE Usuarios
    (
        Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Usuarios PRIMARY KEY,
        CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Usuarios_CompanyId DEFAULT N'empresa-principal',
        Cpf NVARCHAR(30) NOT NULL,
        Name NVARCHAR(180) NOT NULL,
        Email NVARCHAR(180) NOT NULL,
        Phone NVARCHAR(30) NOT NULL CONSTRAINT DF_Usuarios_Phone DEFAULT N'',
        Role NVARCHAR(60) NOT NULL CONSTRAINT DF_Usuarios_Role DEFAULT N'atendente',
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Usuarios_Status DEFAULT N'ativo',
        CreatedAt NVARCHAR(30) NOT NULL CONSTRAINT DF_Usuarios_CreatedAt DEFAULT CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 23),
        LastLoginAt NVARCHAR(60) NOT NULL CONSTRAINT DF_Usuarios_LastLoginAt DEFAULT N'-',
        PasswordHash NVARCHAR(300) NOT NULL,
        MustChangePassword BIT NOT NULL CONSTRAINT DF_Usuarios_MustChangePassword DEFAULT 1,
        CONSTRAINT UQ_Usuarios_Cpf UNIQUE (Cpf),
        CONSTRAINT UQ_Usuarios_Email UNIQUE (Email)
    );
END;

IF COL_LENGTH(N'Usuarios', N'CompanyId') IS NULL
BEGIN
    ALTER TABLE Usuarios ADD CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Usuarios_CompanyId DEFAULT N'empresa-principal';
END;

IF OBJECT_ID(N'Sessoes', N'U') IS NULL
BEGIN
    CREATE TABLE Sessoes
    (
        Id NVARCHAR(80) NOT NULL CONSTRAINT PK_Sessoes PRIMARY KEY,
        UserId NVARCHAR(40) NOT NULL,
        Device NVARCHAR(120) NOT NULL CONSTRAINT DF_Sessoes_Device DEFAULT N'',
        Location NVARCHAR(150) NOT NULL CONSTRAINT DF_Sessoes_Location DEFAULT N'',
        Ip NVARCHAR(64) NOT NULL CONSTRAINT DF_Sessoes_Ip DEFAULT N'',
        LastActive NVARCHAR(80) NOT NULL CONSTRAINT DF_Sessoes_LastActive DEFAULT N'Agora mesmo',
        Platform NVARCHAR(20) NOT NULL CONSTRAINT DF_Sessoes_Platform DEFAULT N'desktop',
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_Sessoes_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_Sessoes_Usuarios FOREIGN KEY (UserId) REFERENCES Usuarios (Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_Sessoes_UserId ON Sessoes (UserId);
END;

IF OBJECT_ID(N'PasswordResetTokens', N'U') IS NOT NULL
   AND COL_LENGTH(N'PasswordResetTokens', N'TokenHash') IS NULL
BEGIN
    DROP TABLE PasswordResetTokens;
END;

IF OBJECT_ID(N'PasswordResetTokens', N'U') IS NULL
BEGIN
    CREATE TABLE PasswordResetTokens
    (
        Id NVARCHAR(40) NOT NULL CONSTRAINT PK_PasswordResetTokens PRIMARY KEY,
        UserId NVARCHAR(40) NOT NULL,
        Email NVARCHAR(180) NOT NULL,
        Cnpj NVARCHAR(30) NULL,
        TokenHash NVARCHAR(128) NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL,
        RequestedAt DATETIMEOFFSET NOT NULL,
        ExpiresAt DATETIMEOFFSET NOT NULL,
        ConsumedAt DATETIMEOFFSET NULL,
        RequestedIp NVARCHAR(64) NULL,
        RequestedUserAgent NVARCHAR(500) NULL,
        RequestedDevice NVARCHAR(120) NULL,
        ResetIp NVARCHAR(64) NULL,
        ResetUserAgent NVARCHAR(500) NULL,
        ResetDevice NVARCHAR(120) NULL,
        UpdatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_PasswordResetTokens_Usuarios FOREIGN KEY (UserId) REFERENCES Usuarios (Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_PasswordResetTokens_UserId ON PasswordResetTokens (UserId);
    CREATE UNIQUE INDEX IX_PasswordResetTokens_TokenHash ON PasswordResetTokens (TokenHash);
    CREATE INDEX IX_PasswordResetTokens_ExpiresAt ON PasswordResetTokens (ExpiresAt);
    CREATE INDEX IX_PasswordResetTokens_ConsumedAt ON PasswordResetTokens (ConsumedAt);
END;

IF OBJECT_ID(N'CaixaSessoes', N'U') IS NULL
BEGIN
    CREATE TABLE CaixaSessoes
    (
        Id NVARCHAR(40) NOT NULL CONSTRAINT PK_CaixaSessoes PRIMARY KEY,
        CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_CaixaSessoes_CompanyId DEFAULT N'empresa-principal',
        OpenedAt DATETIMEOFFSET NOT NULL,
        ClosedAt DATETIMEOFFSET NULL,
        OpeningAmount NVARCHAR(30) NOT NULL CONSTRAINT DF_CaixaSessoes_OpeningAmount DEFAULT N'0,00',
        ClosingAmount NVARCHAR(30) NOT NULL CONSTRAINT DF_CaixaSessoes_ClosingAmount DEFAULT N'0,00',
        OperatorId NVARCHAR(40) NOT NULL,
        OperatorName NVARCHAR(180) NOT NULL CONSTRAINT DF_CaixaSessoes_OperatorName DEFAULT N'',
        ClosedById NVARCHAR(40) NOT NULL CONSTRAINT DF_CaixaSessoes_ClosedById DEFAULT N'',
        ClosedByName NVARCHAR(180) NOT NULL CONSTRAINT DF_CaixaSessoes_ClosedByName DEFAULT N'',
        Note NVARCHAR(500) NOT NULL CONSTRAINT DF_CaixaSessoes_Note DEFAULT N'',
        CONSTRAINT FK_CaixaSessoes_Usuarios FOREIGN KEY (OperatorId) REFERENCES Usuarios (Id)
    );
    CREATE INDEX IX_CaixaSessoes_ClosedAt ON CaixaSessoes (ClosedAt);
END;

IF COL_LENGTH(N'CaixaSessoes', N'CompanyId') IS NULL
BEGIN
    ALTER TABLE CaixaSessoes ADD CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_CaixaSessoes_CompanyId DEFAULT N'empresa-principal';
END;

IF OBJECT_ID(N'Vendas', N'U') IS NULL
BEGIN
    CREATE TABLE Vendas
    (
        Id NVARCHAR(40) NOT NULL CONSTRAINT PK_Vendas PRIMARY KEY,
        CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Vendas_CompanyId DEFAULT N'empresa-principal',
        SaleNumber NVARCHAR(30) NOT NULL,
        CustomerName NVARCHAR(180) NOT NULL CONSTRAINT DF_Vendas_CustomerName DEFAULT N'Consumidor',
        CustomerCpf NVARCHAR(30) NOT NULL CONSTRAINT DF_Vendas_CustomerCpf DEFAULT N'-',
        PaymentType NVARCHAR(30) NOT NULL CONSTRAINT DF_Vendas_PaymentType DEFAULT N'-',
        TotalAmount NVARCHAR(30) NOT NULL CONSTRAINT DF_Vendas_TotalAmount DEFAULT N'0,00',
        OperatorName NVARCHAR(180) NOT NULL CONSTRAINT DF_Vendas_OperatorName DEFAULT N'Operador',
        SaleDate DATETIMEOFFSET NOT NULL CONSTRAINT DF_Vendas_SaleDate DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT UQ_Vendas_SaleNumber UNIQUE (SaleNumber)
    );
END;

IF COL_LENGTH(N'Vendas', N'CompanyId') IS NULL
BEGIN
    ALTER TABLE Vendas ADD CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_Vendas_CompanyId DEFAULT N'empresa-principal';
END;

IF COL_LENGTH(N'Vendas', N'PaymentType') IS NULL
    ALTER TABLE Vendas ADD PaymentType NVARCHAR(30) NOT NULL CONSTRAINT DF_Vendas_PaymentType DEFAULT N'-';
IF COL_LENGTH(N'Vendas', N'TotalAmount') IS NULL
    ALTER TABLE Vendas ADD TotalAmount NVARCHAR(30) NOT NULL CONSTRAINT DF_Vendas_TotalAmount DEFAULT N'0,00';
IF COL_LENGTH(N'Vendas', N'OperatorName') IS NULL
    ALTER TABLE Vendas ADD OperatorName NVARCHAR(180) NOT NULL CONSTRAINT DF_Vendas_OperatorName DEFAULT N'Operador';

IF OBJECT_ID(N'VendaItens', N'U') IS NULL
BEGIN
    CREATE TABLE VendaItens
    (
        Id NVARCHAR(40) NOT NULL CONSTRAINT PK_VendaItens PRIMARY KEY,
        VendaId NVARCHAR(40) NOT NULL,
        ProductCode NVARCHAR(80) NOT NULL,
        ProductName NVARCHAR(180) NOT NULL,
        Quantity INT NOT NULL,
        UnitPrice NVARCHAR(30) NOT NULL CONSTRAINT DF_VendaItens_UnitPrice DEFAULT N'0,00',
        ItemTotal NVARCHAR(30) NOT NULL CONSTRAINT DF_VendaItens_ItemTotal DEFAULT N'0,00',
        CONSTRAINT FK_VendaItens_Vendas FOREIGN KEY (VendaId) REFERENCES Vendas (Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_VendaItens_VendaId ON VendaItens (VendaId);
END;

IF COL_LENGTH(N'VendaItens', N'UnitPrice') IS NULL
    ALTER TABLE VendaItens ADD UnitPrice NVARCHAR(30) NOT NULL CONSTRAINT DF_VendaItens_UnitPrice DEFAULT N'0,00';
IF COL_LENGTH(N'VendaItens', N'ItemTotal') IS NULL
    ALTER TABLE VendaItens ADD ItemTotal NVARCHAR(30) NOT NULL CONSTRAINT DF_VendaItens_ItemTotal DEFAULT N'0,00';

GO

UPDATE i
   SET UnitPrice = COALESCE(NULLIF(LTRIM(RTRIM(p.ProductSalePrice)), ''), NULLIF(LTRIM(RTRIM(p.ProductUnitPrice)), ''), N'0,00')
  FROM VendaItens i
  INNER JOIN Produtos p ON p.ProductCode = i.ProductCode
 WHERE NULLIF(LTRIM(RTRIM(i.UnitPrice)), '') IS NULL
    OR REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(i.UnitPrice)), N'R$', N''), N'.', N''), N',', N'.') IN (N'0', N'0.00');

UPDATE i
   SET ItemTotal = FORMAT(
        TRY_CONVERT(
            DECIMAL(18, 2),
            REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(i.UnitPrice)), N'R$', N''), N'.', N''), N',', N'.')
        ) * i.Quantity,
        N'N2',
        N'pt-BR'
   )
  FROM VendaItens i
 WHERE (NULLIF(LTRIM(RTRIM(i.ItemTotal)), '') IS NULL
    OR REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(i.ItemTotal)), N'R$', N''), N'.', N''), N',', N'.') IN (N'0', N'0.00'))
   AND TRY_CONVERT(
        DECIMAL(18, 2),
        REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(i.UnitPrice)), N'R$', N''), N'.', N''), N',', N'.')
   ) IS NOT NULL;

IF OBJECT_ID(N'ModulosMercado', N'U') IS NULL
BEGIN
    CREATE TABLE ModulosMercado
    (
        Id NVARCHAR(80) NOT NULL CONSTRAINT PK_ModulosMercado PRIMARY KEY,
        Title NVARCHAR(180) NOT NULL
    );
END;

IF OBJECT_ID(N'ModuloMercadoRegistros', N'U') IS NULL
BEGIN
    CREATE TABLE ModuloMercadoRegistros
    (
        Id NVARCHAR(100) NOT NULL CONSTRAINT PK_ModuloMercadoRegistros PRIMARY KEY,
        CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_ModuloMercadoRegistros_CompanyId DEFAULT N'empresa-principal',
        ModuleId NVARCHAR(80) NOT NULL,
        Title NVARCHAR(180) NOT NULL,
        Description NVARCHAR(500) NOT NULL CONSTRAINT DF_ModuloMercadoRegistros_Description DEFAULT N'',
        Status NVARCHAR(80) NOT NULL CONSTRAINT DF_ModuloMercadoRegistros_Status DEFAULT N'',
        Amount NVARCHAR(40) NOT NULL CONSTRAINT DF_ModuloMercadoRegistros_Amount DEFAULT N'',
        Meta NVARCHAR(180) NOT NULL CONSTRAINT DF_ModuloMercadoRegistros_Meta DEFAULT N'',
        CONSTRAINT FK_ModuloMercadoRegistros_ModulosMercado FOREIGN KEY (ModuleId) REFERENCES ModulosMercado (Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_ModuloMercadoRegistros_ModuleId ON ModuloMercadoRegistros (ModuleId);
END;

IF COL_LENGTH(N'ModuloMercadoRegistros', N'CompanyId') IS NULL
BEGIN
    ALTER TABLE ModuloMercadoRegistros ADD CompanyId NVARCHAR(40) NOT NULL CONSTRAINT DF_ModuloMercadoRegistros_CompanyId DEFAULT N'empresa-principal';
END;

IF EXISTS (SELECT 1 FROM Usuarios WHERE Id = N'usr-001')
BEGIN
    UPDATE Usuarios
       SET Cpf = N'06.332.765/0001-05',
           CompanyId = N'empresa-principal',
           Name = N'Flávio Oliveira',
           Email = N'flavio@hpdv.com.br',
           Phone = N'(11) 98888-1111',
           Role = N'administrador',
           Status = N'ativo',
           CreatedAt = N'2026-02-10',
           LastLoginAt = N'-',
           PasswordHash = N'100000.aG9ydXNwZHZzZWVkMTIzNA==.2rLHDQjZmUF6Oolm44OWtYqIU7b1sXCtUV1XOx1JcWc=',
           MustChangePassword = 0
     WHERE Id = N'usr-001';
END
ELSE
BEGIN
    INSERT INTO Usuarios (Id, CompanyId, Cpf, Name, Email, Phone, Role, Status, CreatedAt, LastLoginAt, PasswordHash, MustChangePassword)
    VALUES (N'usr-001', N'empresa-principal', N'06.332.765/0001-05', N'Flávio Oliveira', N'flavio@hpdv.com.br', N'(11) 98888-1111', N'administrador', N'ativo', N'2026-02-10', N'-', N'100000.aG9ydXNwZHZzZWVkMTIzNA==.2rLHDQjZmUF6Oolm44OWtYqIU7b1sXCtUV1XOx1JcWc=', 0);
END;

IF EXISTS (SELECT 1 FROM Empresas WHERE Id = N'empresa-principal')
BEGIN
    UPDATE Empresas
       SET FantasyName = N'Hórus PDV',
           CorporateName = N'Hórus PDV LTDA',
           Cnpj = N'06.332.765/0001-05',
           StateRegistration = N'123.456.789.110',
           Website = N'https://www.horuspdv.com.br',
           Email = N'contato@hpdv.com.br',
           SacPhone = N'(11) 3000-1000',
           Phone = N'(11) 3149-5959',
           Mobile = N'(11) 98888-1000',
           Cep = N'01310-200',
           Address = N'Avenida Paulista',
           Number = N'1578',
           Neighborhood = N'Bela Vista',
           City = N'São Paulo',
           Uf = N'SP',
           Complement = N'Próximo ao MASP',
           EmailSmtpHost = CASE WHEN EmailSmtpHost = N'' THEN N'smtp-mail.outlook.com' ELSE EmailSmtpHost END,
           EmailSmtpPort = CASE WHEN EmailSmtpPort <= 0 THEN 587 ELSE EmailSmtpPort END,
           EmailSmtpEnableSsl = 1,
           EmailSmtpFromEmail = CASE WHEN EmailSmtpFromEmail = N'' THEN N'naoresponderhoruspdv@outlook.com' ELSE EmailSmtpFromEmail END,
           EmailSmtpFromName = CASE WHEN EmailSmtpFromName = N'' THEN N'Hórus PDV' ELSE EmailSmtpFromName END
     WHERE Id = N'empresa-principal';
END
ELSE
BEGIN
    INSERT INTO Empresas
        (Id, FantasyName, CorporateName, Cnpj, StateRegistration, Website, Email, SacPhone, Phone, Mobile,
         Cep, Address, Number, Neighborhood, City, Uf, Complement, EmailSmtpEnabled, EmailSmtpHost,
         EmailSmtpPort, EmailSmtpEnableSsl, EmailSmtpUser, EmailSmtpPassword, EmailSmtpFromEmail,
         EmailSmtpFromName, EmailSmtpReplyTo)
    VALUES
        (N'empresa-principal', N'Hórus PDV', N'Hórus PDV LTDA', N'06.332.765/0001-05',
         N'123.456.789.110', N'https://www.horuspdv.com.br', N'contato@hpdv.com.br',
         N'(11) 3000-1000', N'(11) 3149-5959', N'(11) 98888-1000', N'01310-200',
         N'Avenida Paulista', N'1578', N'Bela Vista', N'São Paulo', N'SP', N'Próximo ao MASP',
         0, N'smtp-mail.outlook.com', 587, 1, N'', N'', N'naoresponderhoruspdv@outlook.com',
         N'Hórus PDV', N'');
END;
