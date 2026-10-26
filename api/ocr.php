<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['error' => 'Use POST to submit a bill.']);
}

if (!function_exists('curl_init') || !class_exists('finfo')) {
    respond(500, ['error' => 'PHP cURL and fileinfo extensions are required.']);
}

$configPath = dirname(__DIR__) . '/private/ocr-space-config.php';
if (!is_file($configPath)) {
    respond(503, ['error' => 'OCR.Space is not configured on this server.']);
}

$config = require $configPath;
$apiKey = is_array($config) ? trim((string) ($config['api_key'] ?? '')) : '';
if ($apiKey === '') {
    respond(503, ['error' => 'OCR.Space is not configured on this server.']);
}

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    respond(400, ['error' => 'Select a bill image or PDF first.']);
}

$upload = $_FILES['file'];
if ($upload['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'])) {
    respond(400, ['error' => 'The bill could not be uploaded to the local server.']);
}
if ((int) $upload['size'] > 1024 * 1024) {
    respond(413, ['error' => 'This demo accepts bill files up to 1 MB.']);
}

$mimeType = (new finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name']);
$allowedTypes = [
    'application/pdf',
    'image/bmp',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/tiff',
];
if (!in_array($mimeType, $allowedTypes, true)) {
    respond(415, ['error' => 'Use a PDF, JPEG, PNG, GIF, TIFF, or BMP bill file.']);
}

$fileName = basename((string) $upload['name']);
$file = new CURLFile($upload['tmp_name'], $mimeType, $fileName);
$request = curl_init('https://api.ocr.space/parse/image');
curl_setopt_array($request, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => [
        'file' => $file,
        'language' => 'eng',
        'OCREngine' => '3',
        'isTable' => 'true',
        'detectOrientation' => 'true',
        'scale' => 'true',
    ],
    CURLOPT_HTTPHEADER => ['apikey: ' . $apiKey],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_TIMEOUT => 90,
]);

$responseBody = curl_exec($request);
$curlError = curl_error($request);
$httpStatus = (int) curl_getinfo($request, CURLINFO_RESPONSE_CODE);
curl_close($request);

if ($responseBody === false) {
    respond(502, ['error' => 'OCR.Space could not be reached: ' . $curlError]);
}

$response = json_decode($responseBody, true);
if (!is_array($response)) {
    respond(502, ['error' => 'OCR.Space returned an unreadable response.']);
}

$parsedResults = $response['ParsedResults'] ?? [];
$textPages = [];
$pageErrors = [];
foreach ($parsedResults as $pageResult) {
    $pageText = trim((string) ($pageResult['ParsedText'] ?? ''));
    if ($pageText !== '') {
        $textPages[] = $pageText;
    }
    $pageError = trim((string) ($pageResult['ErrorMessage'] ?? ''));
    if ($pageError !== '') {
        $pageErrors[] = $pageError;
    }
}

$text = implode("\n\n", $textPages);
$apiError = trim((string) ($response['ErrorMessage'] ?? ''));
if ($httpStatus < 200 || $httpStatus >= 300 || ($response['IsErroredOnProcessing'] ?? false) && $text === '') {
    $message = $apiError ?: implode(' ', $pageErrors) ?: 'OCR.Space could not read this document.';
    respond(502, ['error' => $message]);
}
if ($text === '') {
    respond(422, ['error' => 'No readable text was found. Try a clearer image or enter the bill details manually.']);
}

$warning = ((string) ($response['OCRExitCode'] ?? '') === '2' || $pageErrors !== [])
    ? 'OCR.Space returned a partial result. Check all pages and fields against the bill.'
    : '';

respond(200, [
    'text' => $text,
    'source' => 'OCR.Space',
    'pages' => count($parsedResults),
    'warning' => $warning,
]);