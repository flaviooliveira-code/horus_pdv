# Smoke Test - Segurança e Recuperação de Senha

## Pré-requisitos
- PHP 8+ e MySQL em execução.
- Arquivo `.env` criado a partir de `.env.example` com credenciais reais.
- Pelo menos 1 usuário cadastrado com e-mail válido.

## Execução automatizada
1. Configure no `.env` as variáveis:
- `HPDV_BASE_URL`
- `HPDV_LOGIN_ENDPOINT`
- `HPDV_RECOVER_ENDPOINT`
- `HPDV_CHANGE_ENDPOINT`
- `HPDV_TEST_USER`
- `HPDV_TEST_PASSWORD`
- `HPDV_TEST_CPF`
- `HPDV_CSRF_TOKEN` (ou `HPDV_CSRF_URL` para tentativa automática de captura)
2. Rode:

```bash
cd horuspdv-app/hpdv/backend
./scripts/smoke_auth.sh
```

Resultado esperado:
- Script finaliza com `[OK] Smoke tests concluídos com sucesso.`

## 1) Login
1. Acesse a tela de login.
2. Faça login com usuário e senha válidos.
3. Confirme que o login funciona e redireciona para a home.
4. Faça logout e login novamente para validar persistência normal.

Resultado esperado:
- Login concluído com sucesso sem erro de sessão.

## 2) Recuperar senha (solicitação)
1. Abra a tela "esqueci minha senha".
2. Informe CPF e usuário válidos.
3. Envie a solicitação.

Resultado esperado:
- Mensagem de sucesso.
- E-mail recebido com link de recuperação.

## 3) Alterar senha pelo link
1. Abra o link recebido no e-mail.
2. Informe nova senha e confirmação.
3. Envie o formulário.
4. Volte para login e autentique com a nova senha.

Resultado esperado:
- Senha alterada com sucesso.
- Token não pode ser reutilizado após primeira troca.

## 4) Token inválido/expirado
1. Altere manualmente o token da URL e tente trocar senha.
2. Aguarde mais de 10 minutos e tente usar o link original.

Resultado esperado:
- Em ambos casos o sistema bloqueia a troca com erro de token inválido/expirado.
