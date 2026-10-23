<?php
// Shared by mobile and the existing website login forms. No DB credentials here.
function qha_password_matches($plain, $stored, $db = null) {
    if (!is_string($plain) || !is_string($stored) || strlen($plain) > 4096) return false;
    if (preg_match('/^[a-f0-9]{32}$/i', $stored)) {
        if (hash_equals(strtolower($stored), md5($plain))) return true;
        // The old forms hashed the SQL-escaped, stripslashes-transformed password.
        return $db && hash_equals(strtolower($stored), md5(mysqli_real_escape_string($db, stripslashes($plain))));
    }
    return password_verify($plain, $stored);
}
