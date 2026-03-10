<?php
require_once __DIR__ . "/../config/env.php";
loadEnv(dirname(__DIR__, 2));

class DbConnection
{
    private $host;
    private $dbname;
    private $user;
    private $pass;

    public function __construct()
    {
        $this->host = env('DB_HOST', 'localhost');
        $this->dbname = env('DB_NAME', 'pdv');
        $this->user = env('DB_USER', 'root');
        $this->pass = env('DB_PASS', '');
    }

    public function getConnection()
    {
        try {
            $connect = new PDO(
                "mysql:host=$this->host;dbname=$this->dbname;charset=utf8mb4",
                "$this->user",
                "$this->pass"
            );
            $connect->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            return $connect;
        } catch (PDOException $e) {
            $e = $e->getMessage();
            echo "Erro: $e";
        } catch (Exception $e) {
            $e = $e->getMessage();
            echo "Erro: $e";
        }
    }
}
