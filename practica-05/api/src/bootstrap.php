<?php
declare(strict_types=1);

final class ApiRequestException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status)
    {
        parent::__construct($message);
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = $_ENV['DB_HOST'] ?? (getenv('DB_HOST') ?: '127.0.0.1');
    $port = $_ENV['DB_PORT'] ?? (getenv('DB_PORT') ?: '3306');
    $name = $_ENV['DB_NAME'] ?? (getenv('DB_NAME') ?: 'practica05_bioinformatica');
    $user = $_ENV['DB_USER'] ?? (getenv('DB_USER') ?: 'root');
    $password = $_ENV['DB_PASSWORD'] ?? (getenv('DB_PASSWORD') ?: '');
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";

    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function jsonBody(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        throw new ApiRequestException('El cuerpo debe ser un objeto JSON válido.', 400);
    }
    return $body;
}

function requireFields(array $body, array $fields): void
{
    foreach ($fields as $field) {
        if (!array_key_exists($field, $body)) {
            throw new ApiRequestException("Falta el campo requerido: {$field}", 422);
        }
    }
}

function apiError(Throwable $error): void
{
    if ($error instanceof ApiRequestException) {
        Flight::json(['error' => $error->getMessage()], $error->status);
        return;
    }
    error_log((string)$error);
    Flight::json(['error' => 'Error interno al procesar la solicitud.'], 500);
}
