-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Tempo de geração: 11/04/2024 às 21:29
-- Versão do servidor: 10.4.28-MariaDB

CREATE TABLE `tb_clientes` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `cpf` varchar(14) NOT NULL,
  `rg` varchar(20) DEFAULT NULL,
  `data_nascimento` date NOT NULL,
  `idade` int(11) NOT NULL,
  `cep` varchar(9) NOT NULL,
  `cidade` varchar(100) NOT NULL,
  `uf` char(2) NOT NULL,
  `endereco` varchar(255) NOT NULL,
  `bairro` varchar(100) NOT NULL,
  `complemento` varchar(255) DEFAULT NULL,
  `numero` varchar(10) DEFAULT NULL,
  `ponto_referencia` varchar(255) DEFAULT NULL,
  `telefone` varchar(15) DEFAULT NULL,
  `celular` varchar(15) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `data_criacao` timestamp NOT NULL DEFAULT current_timestamp(),
  `data_modificacao` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TRIGGER `tb_clientes_atualiza_data_modificacao` BEFORE UPDATE ON `tb_clientes` FOR EACH ROW SET NEW.data_modificacao = NOW()
 ;

-- --------------------------------------------------------

--
-- Estrutura para tabela `tb_fornecedores`
--

CREATE TABLE `tb_fornecedores` (
  `id` int(11) NOT NULL,
  `razao_social` varchar(255) NOT NULL,
  `nome_fantasia` varchar(255) NOT NULL,
  `cnpj` varchar(18) NOT NULL,
  `cep` varchar(9) NOT NULL,
  `cidade` varchar(100) NOT NULL,
  `uf` char(2) NOT NULL,
  `endereco` varchar(255) NOT NULL,
  `bairro` varchar(100) NOT NULL,
  `complemento` varchar(255) DEFAULT NULL,
  `numero` varchar(10) DEFAULT NULL,
  `ponto_referencia` varchar(255) DEFAULT NULL,
  `telefone` varchar(15) DEFAULT NULL,
  `celular` varchar(15) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `data_criacao` timestamp NOT NULL DEFAULT current_timestamp(),
  `data_modificacao` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TRIGGER `tb_fornecedores_atualiza_data_modificacao` BEFORE UPDATE ON `tb_fornecedores` FOR EACH ROW SET NEW.data_modificacao = NOW()
 ;

CREATE TABLE `tb_licenca` (
  `id` int(10) UNSIGNED NOT NULL,
  `id_usuario` int(10) UNSIGNED NOT NULL,
  `data_ativacao_sistema` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `data_ultima_renovacao` timestamp NULL DEFAULT NULL,
  `data_proxima_renovacao` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TABLE `tb_produtos` (
  `id` int(11) NOT NULL,
  `imagem_produto` varchar(255) DEFAULT 'produto-sem-imagem.webp',
  `nome_produto` varchar(255) NOT NULL,
  `codigo_produto` varchar(255) NOT NULL,
  `fornecedor` int(11) NOT NULL,
  `descricao_produto` varchar(255) NOT NULL,
  `quantidade_produto` int(11) NOT NULL,
  `preco_unitario_produto` varchar(100) NOT NULL,
  `preco_venda_produto` varchar(100) NOT NULL,
  `preco_total_em_produto` varchar(100) NOT NULL,
  `data_criacao` timestamp NOT NULL DEFAULT current_timestamp(),
  `data_modificacao` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TRIGGER `tb_produtos_atualiza_data_modificacao` BEFORE UPDATE ON `tb_produtos` FOR EACH ROW SET NEW.data_modificacao = NOW()
;

-- --------------------------------------------------------

--
-- Estrutura para tabela `tb_usuarios`
--

CREATE TABLE `tb_usuarios` (
  `id` int(10) UNSIGNED NOT NULL,
  `cpf` varchar(14) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `usuario_acesso` varchar(100) NOT NULL,
  `senha_usuario` varchar(255) NOT NULL,
  `tipo_permissao` enum('administrador','cadastro','venda','usuario') DEFAULT 'usuario',
  `data_ultimo_acesso` timestamp NOT NULL DEFAULT current_timestamp(),
  `data_criacao` timestamp NOT NULL DEFAULT current_timestamp(),
  `data_modificacao` timestamp NULL DEFAULT NULL,
  `token_reset_senha_acesso` varchar(255) DEFAULT NULL,
  `horario_geracao_token` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TRIGGER `atualiza_data_modificacao` BEFORE UPDATE ON `tb_usuarios` FOR EACH ROW SET NEW.data_modificacao = NOW()
;

CREATE TABLE `tb_vendas` (
  `id` int(11) NOT NULL,
  `numero_da_venda` int(11) UNSIGNED NOT NULL,
  `cliente` int(11) NOT NULL,
  `vendedor` varchar(255) NOT NULL,
  `produto` int(11) NOT NULL,
  `quantidade` int(11) NOT NULL,
  `valor_unitario` varchar(255) NOT NULL,
  `subtotal` varchar(255) NOT NULL,
  `tipo_de_pagamento` varchar(255) NOT NULL,
  `desconto` varchar(255) DEFAULT 'sem desconto',
  `valor_com_desconto` varchar(255) DEFAULT 'sem valor com desconto',
  `codigo_de_transacao_ou_chave_pix` varchar(255) DEFAULT 'pagamento feito em dinheiro',
  `valor_a_ser_pago` varchar(255) NOT NULL,
  `data_criacao` timestamp NOT NULL DEFAULT current_timestamp(),
  `data_modificacao` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TRIGGER `tb_vendas_atualiza_data_modificacao` BEFORE UPDATE ON `tb_vendas` FOR EACH ROW SET NEW.data_modificacao = NOW()
;


ALTER TABLE `tb_clientes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cpf` (`cpf`);

--
-- Índices de tabela `tb_fornecedores`
--
ALTER TABLE `tb_fornecedores`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cnpj` (`cnpj`);

--
-- Índices de tabela `tb_licenca`
--
ALTER TABLE `tb_licenca`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_usuario` (`id_usuario`);

--
-- Índices de tabela `tb_produtos`
--
ALTER TABLE `tb_produtos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `codigo_produto` (`codigo_produto`),
  ADD KEY `fornecedor` (`fornecedor`);

--
-- Índices de tabela `tb_usuarios`
--
ALTER TABLE `tb_usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cpf` (`cpf`),
  ADD UNIQUE KEY `usuario_acesso` (`usuario_acesso`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Índices de tabela `tb_vendas`
--
ALTER TABLE `tb_vendas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cliente` (`cliente`),
  ADD KEY `produto` (`produto`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `tb_clientes`
--
ALTER TABLE `tb_clientes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT de tabela `tb_fornecedores`
--
ALTER TABLE `tb_fornecedores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de tabela `tb_licenca`
--
ALTER TABLE `tb_licenca`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de tabela `tb_produtos`
--
ALTER TABLE `tb_produtos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de tabela `tb_usuarios`
--
ALTER TABLE `tb_usuarios`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de tabela `tb_vendas`
--
ALTER TABLE `tb_vendas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=49;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `tb_licenca`
--
ALTER TABLE `tb_licenca`
  ADD CONSTRAINT `tb_licenca_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `tb_usuarios` (`id`);

--
-- Restrições para tabelas `tb_produtos`
--
ALTER TABLE `tb_produtos`
  ADD CONSTRAINT `tb_produtos_ibfk_1` FOREIGN KEY (`fornecedor`) REFERENCES `tb_fornecedores` (`id`);

--
-- Restrições para tabelas `tb_vendas`
--
ALTER TABLE `tb_vendas`
  ADD CONSTRAINT `tb_vendas_ibfk_1` FOREIGN KEY (`cliente`) REFERENCES `tb_clientes` (`id`),
  ADD CONSTRAINT `tb_vendas_ibfk_2` FOREIGN KEY (`produto`) REFERENCES `tb_produtos` (`id`);
COMMIT;
