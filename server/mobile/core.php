<?php
require_once __DIR__.'/passwords.php';
class QHAMobileError extends RuntimeException {
    public $http;
    public function __construct($message, $http=400) { parent::__construct($message); $this->http=$http; }
}
function qha_fail($message,$http=400) { throw new QHAMobileError($message,$http); }
function qha_config() {
    static $c;
    if ($c === null) {
        $path=getenv('QH_MOBILE_CONFIG') ?: dirname(__DIR__,2).'/quickhelp-mobile-config.php';
        if (!is_file($path)) qha_fail('QuickHelp mobile setup is not complete. Please try again later.',503);
        $c=require $path;
        if (!is_array($c) || ($c['origin']??'')!=='https://quickhelp.com.ng') qha_fail('Mobile configuration is invalid.',503);
    }
    return $c;
}
function qha_start() {
    header('Cache-Control: no-store, private');
    header('Referrer-Policy: no-referrer');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    if (session_status()!==PHP_SESSION_ACTIVE) {
        ini_set('session.use_strict_mode','1');
        session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
        session_start();
    }
    if (empty($_SESSION['qha_csrf'])) $_SESSION['qha_csrf']=bin2hex(random_bytes(32));
}
function qha_dbs() {
    static $dbs;
    if (!$dbs) {
        $file=qha_config()['portal_db'];
        $dbs=(function($file){$con=null;$con2=null;require $file;return [$con,$con2];})($file);
        mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
        if (!($dbs[0] instanceof mysqli)) qha_fail('Account service is unavailable.',503);
        $dbs[0]->set_charset('utf8mb4');
    }
    return $dbs;
}
function qha_db(){ return qha_dbs()[0]; }
function qha_query($sql,$params=[],$db=null) {
    $s=($db?:qha_db())->prepare($sql);
    if ($params) {$types='';foreach($params as $p)$types.=is_int($p)?'i':'s';$s->bind_param($types,...$params);}
    $s->execute();return $s;
}
function qha_one($sql,$params=[],$db=null){return qha_query($sql,$params,$db)->get_result()->fetch_assoc();}
function qha_input($b,$key,$max=191) {
    $v=$b[$key]??'';
    if (!is_string($v) || strlen($v)>$max) qha_fail('Please check the '.$key.' field.');
    return trim($v);
}
function qha_phone($raw) {
    if (!is_string($raw) || strlen($raw)>30 || preg_match('/[^0-9+\s()-]/',$raw)) qha_fail('Enter a valid Nigerian mobile number.');
    $n=preg_replace('/\D/','',$raw);
    if (substr($n,0,3)==='234') $n=substr($n,3);
    if (substr($n,0,1)==='0') $n=substr($n,1);
    if (!preg_match('/^[789][0-9]{9}$/',$n)) qha_fail('Enter a valid Nigerian mobile number.');
    return '234'.$n;
}
function qha_rate($scope,$identity,$max,$seconds) {
    $key=hash('sha256',$scope.'|'.$identity);$now=time();
    if (random_int(1,100)===1) { qha_query('DELETE FROM qha_rate_limits WHERE reset_at<?',[$now]); qha_query('DELETE FROM qha_oauth_flows WHERE expires_at<?',[$now]); }
    qha_query('INSERT INTO qha_rate_limits (rate_key,hits,reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=IF(reset_at<=?,1,hits+1),reset_at=IF(reset_at<=?,VALUES(reset_at),reset_at)',[$key,$now+$seconds,$now,$now]);
    $r=qha_one('SELECT hits FROM qha_rate_limits WHERE rate_key=?',[$key]);
    if ((int)$r['hits']>$max) qha_fail('Too many attempts. Please wait before trying again.',429);
}
function qha_ip(){return $_SERVER['REMOTE_ADDR']??'unknown';}
function qha_pending($id) {
    $ref=$_SESSION['ref_token']??'';$next=$_SESSION['qha_next']??'chat';
    $_SESSION=[];session_regenerate_id(true);
    $_SESSION['qha_csrf']=bin2hex(random_bytes(32));$_SESSION['qha_pending_user']=(int)$id;
    $_SESSION['qha_authenticated_at']=time();$_SESSION['ref_token']=$ref;$_SESSION['qha_next']=$next;
}
function qha_user() {
    $id=(int)($_SESSION['qha_pending_user']??$_SESSION['ideal']??0);
    if (!$id) return null;
    if (isset($_SESSION['qha_pending_user'])) {
        if (time()-(int)($_SESSION['qha_authenticated_at']??0)>1800) qha_fail('Please sign in again to continue.',401);
    } elseif (empty($_SESSION['session']) || empty($_SESSION['email'])) return null;
    $u=qha_one('SELECT * FROM users WHERE id=?',[$id]);
    if (!$u) return null;
    if (!isset($_SESSION['qha_pending_user']) && $u['email']!==$_SESSION['email']) return null;
    return $u;
}
function qha_verified($u) {
    $r=qha_one('SELECT phone FROM qha_phone_verifications WHERE user_id=?',[(int)$u['id']]);
    if (!$r) return false;
    try {return hash_equals($r['phone'],qha_phone($u['phone_no']));}catch(QHAMobileError $e){return false;}
}
function qha_status() {
    $u=qha_user();
    return ['csrf'=>$_SESSION['qha_csrf'],'state'=>$u?(qha_verified($u)?'ready':'phone'):'welcome',
        'first_name'=>$u?$u['first_name']:'','phone'=>$u?$u['phone_no']:'',
        'google_enabled'=>!empty(qha_config()['google_client_id'])&&!empty(qha_config()['google_client_secret'])];
}
function qha_http($url,$data=null,$headers=[]) {
    $c=curl_init($url);
    curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>18,
        CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>$headers]);
    if ($data!==null) curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$data]);
    $raw=curl_exec($c);$status=curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);
    $result=is_string($raw)?json_decode($raw,true):null;
    if ($status>=400&&$status<500&&is_array($result)) return ['_http_status'=>$status]+$result;
    if ($status<200||$status>=300||!is_array($result)) qha_fail('The verification service could not complete the request. Please try again.',502);
    return $result;
}
function qha_termii($action,$data) {
    $c=qha_config();$base=rtrim($c['termii_base_url']??'','/');$host=parse_url($base,PHP_URL_HOST);
    if (empty($c['termii_api_key']) || empty($c['termii_sender_id']) || parse_url($base,PHP_URL_SCHEME)!=='https' || !$host || !preg_match('/(^|\.)termii\.(com|ai)$/i',$host)) qha_fail('SMS verification is not configured yet. Please try again later.',503);
    $data['api_key']=$c['termii_api_key'];
    $result=qha_http($base.'/api/sms/otp/'.$action,json_encode($data),['Content-Type: application/json']);
    if ($action==='verify' && isset($result['_http_status'])) return ['verified'=>false];
    return $result;
}
function qha_create_user($first,$last,$email,$hash,$emailVerified=false) {
    $ref=$_SESSION['ref_token']??'';$ref2='';
    if ($ref) {$r=qha_one('SELECT username,referral1 FROM users WHERE username=?',[$ref]);$ref=$r?$r['username']:'';$ref2=$r?$r['referral1']:'';}
    $values=['first_name'=>$first,'last_name'=>$last,'username'=>$email,'email'=>$email,'password'=>$hash,
        'phone_no'=>'','code'=>'','trn_date'=>date('Y-m-d H:i:s'),'points'=>0,'admin'=>0,'advertiser'=>0,'user_type'=>'0','business_category'=>'none',
        'payment_status'=>'0','referral1'=>$ref,'referral2'=>$ref2,'referral_status'=>'','earnings'=>0,
        'bonus'=>'0','bonus_marker'=>'0','current_earning'=>'200.00','ads_earnings'=>'0.00','old_earning'=>'0.00',
        'ref_earnings'=>'0.00','total_earnings'=>'0.00','banker'=>'','account_no'=>'','name_on_account'=>'',
        'app_id'=>'','gender'=>'','dob'=>'','ref_code'=>bin2hex(random_bytes(8)),'profession'=>'','services'=>'','products'=>'',
        'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')];
    if ($emailVerified)$values['email_verified_at']=date('Y-m-d H:i:s');
    // Tolerate optional legacy columns, but never guess defaults for unknown required columns.
    $columns=qha_query('SHOW COLUMNS FROM users')->get_result()->fetch_all(MYSQLI_ASSOC);
    $names=array_column($columns,'Field');$values=array_intersect_key($values,array_flip($names));
    qha_query('INSERT INTO users (`'.implode('`,`',array_keys($values)).'`) VALUES ('.implode(',',array_fill(0,count($values),'?')).')',array_values($values));
    return (int)qha_db()->insert_id;
}
function qha_phone_available($phone,$id) {
    $local='0'.substr($phone,3);
    $taken=qha_one('SELECT id FROM users WHERE id<>? AND REPLACE(REPLACE(REPLACE(phone_no," ",""),"-",""),"+","") IN (?,?) LIMIT 1',[$id,$phone,$local]);
    $verified=qha_one('SELECT user_id FROM qha_phone_verifications WHERE phone=? AND user_id<>?',[$phone,$id]);
    if ($taken||$verified) qha_fail('This number is linked to another account. Sign in to that account or contact QuickHelp support.',409);
}
function qha_activate($u) {
    // Preserve numeric membership. auth21.php remains the role/access authority on the website.
    $next=$_SESSION['qha_next']??'chat';$_SESSION=[];session_regenerate_id(true);
    foreach(['email','username','first_name','last_name','phone_no','user_type','points','current_earning','ref_earnings','banker','account_no','referral1','bonus','bonus_marker','ref_code'] as $k) $_SESSION[$k]=$u[$k]??'';
    $_SESSION['ideal']=(int)$u['id'];$_SESSION['session']=bin2hex(random_bytes(24));
    $_SESSION['qha_csrf']=bin2hex(random_bytes(32));$_SESSION['qha_next']=$next;
    $now=date('Y-m-d H:i:s');qha_query('UPDATE users SET last_access=? WHERE id=?',[$now,(int)$u['id']]);
}
