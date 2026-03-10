<?php
session_start();
require __DIR__ . "/../database/db_connection.php";
require __DIR__ . "/../models/login_model.php";
require __DIR__ . "/../services/login_service.php";

require __DIR__ . "/../models/license_model.php";
require __DIR__ . "/../services/license_service.php";

$connect = new DbConnection();
$model_user = new LoginModel();
$model_license = new LicenseModel();

function redirect($msg)
{
    echo json_encode($msg);
    exit();
}

$access_credentials = json_encode($_POST);
$access_credentials_decode = json_decode($access_credentials);

$csrf_token = $access_credentials_decode->csrfToken;
$access_user = $access_credentials_decode->accessUser;
$access_password = $access_credentials_decode->accessPassword;


if (!isset($csrf_token) || $csrf_token != $_SESSION['csrf_token']) {
    //erro de autenticação csrf
    redirect(array("error" => "erro1", "message" => "Token de autenticação inválido."));
} else {
    if (!isset($access_user) || !isset($access_password) || empty($access_user) || empty($access_password)) {
        //credenciais de acesso inválidas
        redirect(array("error" => "erro2", "message" => "Usuário ou senha inválidos. Verifique suas credenciais."));
    } elseif (strlen($access_user) < 3) {
        //usuario muito curto
        redirect(array("error" => "erro3", "message" => "O usuário deve ter no mínimo 3 caracteres."));
    } elseif (strlen($access_password) < 6) {
        //senha muito curta
        redirect(array("error" => "erro4", "message" => "A senha deve ter no mínimo 6 caracteres."));
    } else {

        #verificar se o usuário existe no banco de dados
        $model_user->__set("usuario_acesso", $access_user);
        $service_user = new LoginService($connect, $model_user);
        $user_exists = $service_user->verifyUserExists();
        if (empty($user_exists)) {
            redirect(array("error" => "erro5", "message" => "Usuário inexistente no sistema."));
        } else {
            // verificar se a senha bate com a senha do usuário    
            $password_decoder = $service_user->verifyPassword();
            if (password_verify($access_password, $password_decoder->senha_usuario)) {

                //verificar a licença
                $id_user = $user_exists->id;
                $license_service = new LicenseService($connect, $model_license);
                $license_exists = $license_service->verifyLicenseExists($id_user);

                //se não existir um id_usuario e nem data de ativação = (será o primeiro acesso)
                //Nesse caso o sistema irá gerar uma licença para o usuário
                if (empty($license_exists->id_usuario) && empty($license_exists->data_ativacao_sistema)) {

                    // configurando o horário para o fuso de São Paulo
                    date_default_timezone_set('America/Sao_Paulo');

                    $model_license->__set("id_usuario", $id_user);
                    $model_license->__set("data_ativacao_sistema", date("Y-m-d H:i:s"));
                    $model_license->__set("data_ultima_renovacao", date("Y-m-d H:i:s"));

                    //calculo de 30 dias a partir da última renovação para a próxima renovação
                    $data_ultima_renovacao = new DateTime($model_license->__get("data_ultima_renovacao"));
                    $data_ultima_renovacao->add(new DateInterval('P30D'));
                    $model_license->__set("data_proxima_renovacao", $data_ultima_renovacao->format('Y-m-d H:i:s'));
                    $result = $license_service->generateLicense($id_user);
                    if (!$result) {
                        redirect(array("error" => "erro7", "message" => "Erro ao gerar licença."));
                    }
                }

                // Se existir ID e data de Ativação, verificar  se a licença esta ativa
                if (!empty($license_exists->id) && (!empty($license_exists->data_ativacao_sistema))) {
                    // configurando o horário para o fuso de São Paulo
                    date_default_timezone_set('America/Sao_Paulo');

                    //recuperar a última renovação
                    $model_license->__set('id_usuario', $id_user);
                    $last_renewal = $license_service->getLastRenewal();

                    //verificar se a dta atual é mairo que a data da próxima renovação
                    $date_now = new DateTime(date("Y-m-d H:i:s"));
                    $date_next_renewal = new DateTime($last_renewal->data_proxima_renovacao);

                    if ($date_now > $date_next_renewal) {
                        redirect(array("error" => "erro8", "message" => "Licença expirada, favor renovar a licença."));
                    }
                }

                //redirect(array("success" => "Login efetuado com sucesso!"));
                //credenciais de acesso válidas
                //realizar a autenticação
                //redirecionar para a página principal
                session_regenerate_id(true);
                $_SESSION['csrf_token'] = $csrf_token;
                $_SESSION['id_user'] = $user_exists->id;
                $_SESSION['access_user'] = $access_user;
                $_SESSION['name_user'] = $user_exists->nome;
                $_SESSION['email_user'] = $user_exists->email;
                $_SESSION['type_permission'] = $user_exists->tipo_permissao;
                $_SESSION['cpf_user'] = $user_exists->cpf;
                $_SESSION['authenticated'] = true;

                //atualizar a coluna de data de acesso ao sistema do usuário
                // configurando o horário para o fuso de São Paulo
                date_default_timezone_set('America/Sao_Paulo');
                $model_user->__set('id', $user_exists->id);
                $model_user->__set('data_ultimo_acesso', date("Y-m-d H:i:s"));
                $result = $service_user->updateLastAccess();
                if (!$result) {
                    redirect(array("error" => "erro9", "message" => "Erro ao atualizar data de último acesso."));
                }
                // redicionar o usuário para página de home
                redirect(array("success" => "Login efetuado com sucesso!"));
            } else {
                redirect(array("error" => "erro6", "message" => "Senha inválida."));
            }
        }
    }
}
