<?php
session_start();
require __DIR__ . "/../database/db_connection.php";
require __DIR__ . "/../models/login_model.php";
require __DIR__ . "/../services/login_service.php";


//import phpmailer
require __DIR__ . "/../utils/phpmailer/PHPMailer.php";
require __DIR__ . "/../utils/phpmailer/SMTP.php";
require __DIR__ . "/../utils/phpmailer/Exception.php";

$connect = new DbConnection();
$model_user = new LoginModel();
$service_user = new LoginService($connect, $model_user);

function redirect($msg)
{
    echo json_encode($msg);
    exit();
}

$access_credentials = json_encode($_POST);
$access_credentials_decode = json_decode($access_credentials);
$cpf = $access_credentials_decode->cpf;
$accessUser = $access_credentials_decode->accessUser;

$model_user->__set("cpf", $cpf);
$model_user->__set("usuario_acesso", $accessUser);

$result_user_and_password = $service_user->recoverPassword();

//se existir o usuário e o cpf no banco de dados que o usuário informou
if ($result_user_and_password) {

    //gerar o token de recuperação de senha para envio no email do usuário
    $token = bin2hex(random_bytes(32));
    $token_hash = hash('sha256', $token);

    //horario de geração do token -> São Paulo
    date_default_timezone_set('America/Sao_Paulo');
    $date_gerenate_token = date('Y-m-d H:i:s');

    //salvar esse token na tabela de usuário para verificar se o token é válido
    $model_user->__set('cpf', $cpf);
    $model_user->__set('usuario_acesso', $accessUser);
    $model_user->__set('token_reset_senha_acesso', $token_hash);
    $model_user->__set('horario_geracao_token', $date_gerenate_token);

    //salvar o token no banco de dados
    $saveTokenResetPassword = $service_user->saveTokenResetPassword();
    if ($saveTokenResetPassword) {

        $user = $result_user_and_password->usuario_acesso;
        $email_recover = $result_user_and_password->email;

        //criptografar o token para enviar no email
        $token_crypt = base64_encode($token);
        $user_crypt = base64_encode($user);
        $base_url = rtrim(env('APP_BASE_URL', 'http://localhost'), '/');
        $reset_password_url = $base_url . "/app/web/alterar-senha?u=$user_crypt&t=$token_crypt";

        //enviar o email para o usuário. Formato HTML
        $mensagem = "<html>
                        <head>
                            <style>
                              body {
                                    font-family: Arial, sans-serif;
                                }
                                
                               .container {
                                    max-width: 600px;
                                    margin: 0 auto;
                                    padding: 20px;
                                    background-color: #211D3A;
                                    border: 1px solid #1E293B;
                                    box-shadow: 0 0 0.625rem rgba(16, 13, 35, 0.6);
                                    text-align: center;
                                    border-radius: 20px;
                                }
                                
                                h2 {
                                    color: #ffffff;
                                    margin-top: 0;
                                }
                                
                                p {
                                    margin-bottom: 20px;
                                    color: #ffffff;
                                }

                                a {
                                    color: #ffffff;
                                    text-decoration: none;
                                    border: 2px solid #e9e9e9;                          
                                    padding: 20px;
                                    margin: 10px;
                                    display: inline-block;
                                }
                            </style>
                        </head>
                        <body>
                            <div class=\"container\">
                                <h2>Recuperação de senha - Hórus PDV</h2>
                                <p>Você solicitou a recuperação de senha do Hórus PDV.
                                Caso não tenha sido você, por favor, desconsidere este email.</p>
                                <p>Recomendamos que altere sua senha periodicamente.</p>
                           ";

        $mensagem .= "
                                <p>Para alterar sua senha, clique no link abaixo:</p>
                                <p><a href=\"$reset_password_url\">Alterar senha</a></p>
                                <p>O link é válido por 10 minutos</p>
                                <p>Atenciosamente,</p>
                                <p>Equipe Hórus PDV</p>     

         </div>
                        </body>
                        </html>";

        //chamando a função do phpmailer
        $smtp_host = env('SMTP_HOST');
        $smtp_username = env('SMTP_USER');
        $smtp_password = env('SMTP_PASS');
        $smtp_port = (int) env('SMTP_PORT', 465);
        $smtp_secure = env('SMTP_SECURE', 'ssl');
        $smtp_auth = filter_var(env('SMTP_AUTH', 'true'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $mail_from = env('MAIL_FROM', $smtp_username ?: '');
        $mail_from_name = env('MAIL_FROM_NAME', 'Hórus PDV');

        if (empty($smtp_host) || empty($smtp_username) || empty($smtp_password) || empty($mail_from)) {
            redirect(array("error" => "erro", "message" => "Configuração de SMTP ausente. Verifique o arquivo .env."));
        }

        $mail = new PHPMailer\PHPMailer\PHPMailer();
        $mail->isSMTP(); // Não modifique
        $mail->Host = $smtp_host;
        $mail->SMTPAuth = $smtp_auth === null ? true : $smtp_auth;
        $mail->Username = $smtp_username;
        $mail->Password = $smtp_password;
        $mail->SMTPSecure = $smtp_secure;
        $mail->Port = $smtp_port > 0 ? $smtp_port : 465;
        $mail->CharSet = 'UTF-8';    //DEFINE O CHARSET UTILIZADO

        //Recipients
        $mail->setFrom($mail_from, $mail_from_name);
        $mail->addAddress($email_recover);     // QUAL EMAIL RECEBERÁ A MENSAGEM!
        //$mail->addBCC(''); //ADICIONANDO BCC

        // Content
        $mail->isHTML(true);                                  // Set email format to HTML
        $mail->Subject = 'Recuperação de senha Hórus PDV'; //ASSUNTO
        $mail->Body    = $mensagem;  //CORPO DA MENSAGEM
        $mail->AltBody = strip_tags($mensagem); //CORPO DA MENSAGEM - TEXTO PLANO

        if ($mail->send()) {
            redirect(array("success" => "sucesso", "message" => "Foi enviado um link de recuperação de senha no email do usuário!"));
        } else {
            redirect(array("error" => "erro", "message" => "Erro ao enviar o email."));
        }
    } else {
        redirect(array("error" => "erro", "message" => "Erro ao salvar o token."));
    }
} else {
    redirect(array("error" => "erro", "message" => "Usuário ou CPF inválidos."));
}
