<?php
/* Shared contact-form handler for both sites.
 *
 * One handler, one credential, one lead log. The sites are told apart by a
 * hidden "site" field the page posts, checked against SITES below - an
 * allowlist rather than free text, so nothing a visitor types can reach the
 * subject line or the log unchecked.
 *
 * Order of work matters here: the lead is written to disk BEFORE any attempt
 * to send mail. A wrong password, a revoked app password or a Gmail outage
 * then costs a notification, not the lead itself.
 *
 * Layout this expects on the server:
 *   /var/www/html/servio-ai-agents/    the Servio export
 *   /var/www/html/cura-ai-agents/      the Cura export
 *   /var/www/html/api/contact.php      this file
 *   /etc/automaxion/smtp.env           credentials, chmod 600, OUTSIDE web root
 *   /var/log/automaxion/leads.jsonl    lead log,    chmod 600, OUTSIDE web root
 */
declare(strict_types=1);

const ENV_FILE = '/etc/automaxion/smtp.env';
const LOG_FILE = '/var/log/automaxion/leads.jsonl';
const RATE_DIR = '/tmp/automaxion-rate';
const RATE_MAX = 5;      // submissions per IP
const RATE_WIN = 3600;   // per hour

/* Label used in the subject line and stored against each lead. */
const SITES = [
    'servio' => 'Servio',
    'cura'   => 'Cura AI',
];

/* The Framer export ships eleven decoy fields that no human ever sees. */
const HONEYPOTS = ['website', 'company', 'message', 'subject', 'title', 'description',
                   'feedback', 'notes', 'details', 'remarks', 'comments'];

header('Content-Type: application/json; charset=utf-8');

function out(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    out(405, ['success' => false, 'message' => 'Method not allowed']);
}

/* ---------- input ---------- */

$raw = file_get_contents('php://input');
if ($raw === false) {
    $raw = '';
}
if (strlen($raw) > 64 * 1024) {
    out(413, ['success' => false, 'message' => 'Payload too large']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    // fall back to a normal form post, so the handler still works if JS is off
    $data = $_POST;
}
if (!is_array($data) || count($data) === 0) {
    out(400, ['success' => false, 'message' => 'Empty submission']);
}

/* Anything filled into a honeypot means a bot. Answer 200 so it cannot tell
   it was caught and retry with the field left blank. */
foreach (HONEYPOTS as $h) {
    if (isset($data[$h]) && is_scalar($data[$h]) && trim((string)$data[$h]) !== '') {
        out(200, ['success' => true, 'message' => 'Thank you']);
    }
}

$site = strtolower(trim((string)($data['site'] ?? '')));
if (!isset(SITES[$site])) {
    out(400, ['success' => false, 'message' => 'Unknown site']);
}
$siteLabel = SITES[$site];

/* Pull the fields we care about whatever the page happens to call them: the
   two exports use different labels for the same things (Name vs Full Name,
   Mobile number vs Phone Number). */
function pick(array $d, array $names): string
{
    foreach ($names as $n) {
        foreach ($d as $k => $v) {
            if (strcasecmp(trim((string)$k), $n) === 0 && is_scalar($v) && trim((string)$v) !== '') {
                return trim((string)$v);
            }
        }
    }
    return '';
}

$name  = pick($data, ['Name', 'Full Name']);
$email = pick($data, ['Email']);
$phone = pick($data, ['Mobile number', 'Phone Number']);

if ($name === '' || $email === '') {
    out(422, ['success' => false, 'message' => 'Name and email are required']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    out(422, ['success' => false, 'message' => 'That email address looks wrong']);
}
/* A newline in a header value lets an attacker append headers of their own,
   and both of these go into headers below. */
if (preg_match('/[\r\n]/', $email . $name) === 1) {
    out(422, ['success' => false, 'message' => 'Invalid input']);
}

/* Everything else the form carried, minus honeypots and internals - keeps the
   handler working when either site adds or renames a question.
 *
 * Matched case-sensitively, and deliberately. Framer emits its decoys in
 * lower case ("message"), but Cura's real textarea is "Message" - lowercasing
 * before the comparison threw the visitor's actual enquiry away as if it were
 * a decoy, which on a hospital form is the most useful line in the message. */
$skip  = array_merge(HONEYPOTS, ['site', '_subject', 'access_key']);
$extra = [];
foreach ($data as $k => $v) {
    $key = trim((string)$k);
    if ($key === '' || in_array($key, $skip, true)) {
        continue;
    }
    if (!is_scalar($v)) {
        continue;
    }
    $val = trim((string)$v);
    if ($val !== '') {
        $extra[$key] = mb_substr($val, 0, 2000);
    }
}

/* ---------- rate limit ---------- */

$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
@mkdir(RATE_DIR, 0700, true);
$bucket = RATE_DIR . '/' . hash('sha256', $ip);
$hits   = [];
if (is_readable($bucket)) {
    $stored = json_decode((string)file_get_contents($bucket), true);
    if (is_array($stored)) {
        $cutoff = time() - RATE_WIN;
        $hits   = array_filter($stored, static fn($t) => is_int($t) && $t > $cutoff);
    }
}
if (count($hits) >= RATE_MAX) {
    out(429, ['success' => false, 'message' => 'Too many submissions. Please try again later.']);
}
$hits[] = time();
@file_put_contents($bucket, json_encode(array_values($hits)), LOCK_EX);

/* ---------- log first, send second ---------- */

$record = [
    'at'     => gmdate('c'),
    'site'   => $site,
    'name'   => $name,
    'email'  => $email,
    'phone'  => $phone,
    'fields' => $extra,
    'ip'     => $ip,
    'ua'     => mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
];
@mkdir(dirname(LOG_FILE), 0700, true);
$logged = @file_put_contents(
    LOG_FILE,
    json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n",
    FILE_APPEND | LOCK_EX
);
if ($logged === false) {
    error_log('contact.php: could not write ' . LOG_FILE);
} else {
    @chmod(LOG_FILE, 0600);
}

/* ---------- mail ---------- */

$cfg = [];
if (is_readable(ENV_FILE)) {
    $lines = file(ENV_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines === false ? [] : $lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $line, 2);
        $cfg[trim($k)] = trim($v);
    }
} else {
    error_log('contact.php: cannot read ' . ENV_FILE);
}

$body   = [];
$body[] = 'A new enquiry came in from the ' . $siteLabel . ' site.';
$body[] = '';
$body[] = 'Name:  ' . $name;
$body[] = 'Email: ' . $email;
if ($phone !== '') {
    $body[] = 'Phone: ' . $phone;
}

/* The three above are already shown, so they are not repeated below. */
$shown = ['name', 'full name', 'email', 'mobile number', 'phone number'];
foreach ($extra as $k => $v) {
    if (!in_array(strtolower($k), $shown, true)) {
        $body[] = $k . ': ' . $v;
    }
}
$body[] = '';
$body[] = 'Received: ' . gmdate('Y-m-d H:i:s') . ' UTC';
$body[] = 'Source:   ' . $siteLabel . ' (' . $site . ')';

$sent = smtp_send(
    $cfg,
    '[' . $siteLabel . '] New enquiry from ' . $name,
    implode("\r\n", $body),
    $email,
    $name
);

/* Only a total failure - neither logged nor sent - is reported to the visitor,
   since a logged lead is not lost even when the mail did not go out. */
if (!$sent && $logged === false) {
    out(500, ['success' => false, 'message' => 'Could not send. Please email us directly.']);
}
out(200, ['success' => true, 'message' => 'Thank you - we will be in touch shortly.']);


/* ---------- raw SMTP over STARTTLS ----------
   Written out rather than pulled from a library so the server has no Composer
   dependency to install or keep patched. This is the same exchange that was
   tested against Gmail before any of this was wired up. */
function smtp_send(array $cfg, string $subject, string $body, string $replyTo, string $replyName): bool
{
    $host = $cfg['SMTP_HOST'] ?? 'smtp.gmail.com';
    $port = (int)($cfg['SMTP_PORT'] ?? 587);
    $user = (string)($cfg['SMTP_USER'] ?? '');
    /* Google prints the app password in four groups of four; those spaces are
       presentation only and are the usual cause of a 535. */
    $pass = str_replace(' ', '', (string)($cfg['SMTP_PASS'] ?? ''));
    $to   = (string)($cfg['MAIL_TO'] ?? '');

    if ($user === '' || $pass === '' || $to === '') {
        error_log('contact.php: SMTP config incomplete');
        return false;
    }

    $fp = @stream_socket_client('tcp://' . $host . ':' . $port, $errno, $errstr, 10);
    if ($fp === false) {
        error_log('contact.php: SMTP connect failed: ' . $errstr);
        return false;
    }
    stream_set_timeout($fp, 15);

    /* An SMTP reply may span several lines: continuation lines put a hyphen
       after the code, the final line a space. */
    $read = static function () use ($fp): string {
        $out = '';
        while (($l = fgets($fp)) !== false) {
            $out .= $l;
            if (strlen($l) >= 4 && $l[3] === ' ') {
                break;
            }
        }
        return rtrim($out);
    };
    $say = static function (string $c) use ($fp, $read): string {
        fwrite($fp, $c . "\r\n");
        return $read();
    };

    $read();
    $say('EHLO automaxion');
    $r = $say('STARTTLS');
    if (!str_starts_with($r, '220')) {
        error_log('contact.php: STARTTLS refused: ' . $r);
        fclose($fp);
        return false;
    }
    if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        error_log('contact.php: TLS negotiation failed');
        fclose($fp);
        return false;
    }
    $say('EHLO automaxion');
    $say('AUTH LOGIN');
    $say(base64_encode($user));
    $r = $say(base64_encode($pass));
    if (!str_starts_with($r, '235')) {
        error_log('contact.php: AUTH failed: ' . $r);
        fclose($fp);
        return false;
    }

    $say('MAIL FROM:<' . $user . '>');
    $r = $say('RCPT TO:<' . $to . '>');
    if (!str_starts_with($r, '25')) {
        error_log('contact.php: recipient refused: ' . $r);
        fclose($fp);
        return false;
    }
    $r = $say('DATA');
    if (!str_starts_with($r, '354')) {
        error_log('contact.php: DATA refused: ' . $r);
        fclose($fp);
        return false;
    }

    /* Headers are encoded so a non-ASCII name cannot break them. The visitor's
       address goes in Reply-To, so replying reaches the lead while the message
       itself stays sent by the authenticated account and Gmail signs it. */
    $enc  = static fn(string $s): string => '=?UTF-8?B?' . base64_encode($s) . '?=';
    $hdrs = 'From: Automaxion Forms <' . $user . '>' . "\r\n"
          . 'To: <' . $to . '>' . "\r\n"
          . 'Reply-To: ' . $enc($replyName) . ' <' . $replyTo . '>' . "\r\n"
          . 'Subject: ' . $enc($subject) . "\r\n"
          . 'Date: ' . date('r') . "\r\n"
          . 'MIME-Version: 1.0' . "\r\n"
          . 'Content-Type: text/plain; charset=UTF-8' . "\r\n"
          . 'Content-Transfer-Encoding: base64' . "\r\n";

    /* base64 means no line of the body can ever be a bare ".", so the
       end-of-data marker cannot be triggered early by the visitor's text. */
    fwrite($fp, $hdrs . "\r\n" . chunk_split(base64_encode($body), 76, "\r\n") . "\r\n.\r\n");
    $r = $read();
    $say('QUIT');
    fclose($fp);

    if (!str_starts_with($r, '250')) {
        error_log('contact.php: send rejected: ' . $r);
        return false;
    }
    return true;
}
