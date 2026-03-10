<?php
session_start();
require __DIR__ . "/../database/db_connection.php";

$connect = new DbConnection();
$conect = $connect->getConnection();

function redirect($msg)
{
    echo json_encode($msg);
    exit();
}

function decode_if_base64($value)
{
    $decoded = base64_decode($value, true);
    if ($decoded === false || $decoded === '') {
        return $value;
    }

    return base64_encode($decoded) === $value ? $decoded : $value;
}

$passwords = json_encode($_POST);
$new_passwords_decode = json_decode($passwords);
$new_password = $new_passwords_decode->newPassword;
$repeat_password = $new_passwords_decode->repeatPassword;
$token_raw = trim((string) $new_passwords_decode->value);
$user_raw = trim((string) $new_passwords_decode->atrribute);

$token = decode_if_base64($token_raw);
$user = decode_if_base64($user_raw);

if (!isset($new_password) || !isset($repeat_password) || empty($new_password) || empty($repeat_password)) {
    redirect(array("error" => "erro1", "message" => "Preencha todos os campos."));
} elseif ($new_password != $repeat_password) {
    redirect(array("error" => "erro2", "message" => "As senhas não conferem."));
} elseif (strlen($new_password) < 6) {
    redirect(array("error" => "erro3", "message" => "A senha deve ter no mínimo 6 caracteres."));
} else {

    // criptografar a nova senha
    $new_password_hash = password_hash($new_password, PASSWORD_DEFAULT);

    try {
        $conect->beginTransaction(); //begin transaction é usado para garantir que todas as operações sejam concluídas com sucesso

        // validar o token recebido com o hash salvo no banco
        $query = "SELECT token_reset_senha_acesso, horario_geracao_token FROM tb_usuarios WHERE usuario_acesso = :usuario_acesso";
        $stmt = $conect->prepare($query);
        $stmt->bindValue(':usuario_acesso', $user);
        $stmt->execute();
        $result_token = $stmt->fetch(PDO::FETCH_OBJ);
        $token_hash = hash('sha256', $token);

        if (
            !$result_token ||
            empty($result_token->token_reset_senha_acesso) ||
            !hash_equals($result_token->token_reset_senha_acesso, $token_hash)
        ) {
            $conect->rollBack();
            redirect(array("error" => "erro4", "message" => "Token inválido. A senha não pode ser alterada."));
        }

        #tempo de expiração do token
        $time_expire_token = 600; #10 minutos

        date_default_timezone_set('America/Sao_Paulo');
        $date_now = strtotime(date('Y-m-d H:i:s'));

        // pegando o horário do token que foi salvo no banco e somando mais 10 minutos
        $date_token = strtotime($result_token->horario_geracao_token);
        $date_token = $date_token + $time_expire_token;

        // verificar se o horário atual é menor do que o horário do token + 10 minutos 
        if ($date_token >= $date_now) {

            //atualizar senha do usuário 
            $query = "UPDATE tb_usuarios SET senha_usuario = :nova_senha WHERE usuario_acesso = :usuario_acesso";
            $stmt = $conect->prepare($query);
            $stmt->bindValue(':nova_senha', $new_password_hash);
            $stmt->bindValue(':usuario_acesso', $user);
            $stmt->execute();
            $result_update_password = $stmt->rowCount();

            if ($result_update_password > 0) {

                // remover os valores do token e horário de geração do token do banco
                $query = "UPDATE tb_usuarios SET token_reset_senha_acesso = NULL, horario_geracao_token = NULL WHERE usuario_acesso = :usuario_acesso";
                $stmt = $conect->prepare($query);
                $stmt->bindValue(':usuario_acesso', $user);
                $result = $stmt->execute();

                if ($result) {
                    $conect->commit();
                    redirect(array("success" => "sucesso", "message" => "Senha alterada com sucesso."));
                } else {
                    $conect->rollBack();
                    redirect(array("error" => "erro6", "message" => "Erro ao remover o token. A senha não foi alterada."));
                }
            } else {
                $conect->rollBack();
                redirect(array("error" => "erro7", "message" => "Erro ao alterar a senha."));
            }
        } else {

            //token expirado, zeramos o token e o horário de geração do token. Com isso o usuário deverá ir novamente na página de recuperação de senha
            $query = "UPDATE tb_usuarios SET token_reset_senha_acesso = NULL, horario_geracao_token = NULL WHERE usuario_acesso = :usuario_acesso";
            $stmt = $conect->prepare($query);
            $stmt->bindValue(':usuario_acesso', $user);
            $stmt->execute();

            redirect(array("error" => "erro5", "message" => "Token expirado. A senha não pode ser alterada."));
        }
    } catch (PDOException $e) {
        if ($conect->inTransaction()) {
            $conect->rollBack();
        }
        redirect(array("error" => "erro8", "message" => $e->getMessage()));
    }
}
