<?php
declare(strict_types=1);
/* API local AgroPlant: PHP 8+, PDO_MYSQL, cURL u OpenSSL.
 * El HTML nunca recibe credenciales de MariaDB. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$config = require __DIR__.'/config.php';
$ROOT = dirname(__DIR__);
$CAT = json_decode((string)file_get_contents($ROOT.'/data/catalogo_completo.json'), true);

function out($payload,int $status=200): never {
 http_response_code($status);
 echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
 exit;
}
function db(): ?PDO {
 global $config;
 static $pdo = false;
 if ($pdo !== false) return $pdo;
 if (!extension_loaded('pdo_mysql')) { $pdo=null; return null; }
 try {
  $dsn='mysql:host='.$config['db_host'].';port='.$config['db_port'].';dbname='.$config['db_name'].';charset=utf8mb4';
  $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'],[
   PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
   PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
   PDO::ATTR_EMULATE_PREPARES=>false,
   PDO::ATTR_TIMEOUT=>5]);
 } catch(Throwable $e) { $pdo=null; }
 return $pdo;
}
function cache(string $key,int $seconds,callable $load): mixed {
 global $ROOT;
 $path=$ROOT.'/cache/'.preg_replace('/[^a-zA-Z0-9_-]/','_', $key).'.json';
 if (is_file($path) && time()-filemtime($path)<$seconds) {
  $a=json_decode((string)file_get_contents($path),true);
  if ($a!==null) return $a;
 }
 $r=$load();
 if ($r!==null) {
  $tmp=$path.'.'.getmypid().'.tmp';
  @file_put_contents($tmp,json_encode($r,JSON_UNESCAPED_UNICODE));
  @rename($tmp,$path);
 }
 return $r;
}
function remote(string $url,int $timeout=18): array {
 if (!str_starts_with($url,'https://')) throw new RuntimeException('Dirección no segura');
 if (function_exists('curl_init')) {
  $ch=curl_init($url);
  curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,
   CURLOPT_CONNECTTIMEOUT=>6,CURLOPT_TIMEOUT=>$timeout,
   CURLOPT_MAXREDIRS=>3,CURLOPT_USERAGENT=>'AgroPlant/2.0 NASA-SpaceApps Educational',
   CURLOPT_HTTPHEADER=>['Accept: application/json'],CURLOPT_ENCODING=>'']);
  $raw=curl_exec($ch); $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
  $err=curl_error($ch); curl_close($ch);
  if ($raw===false || $status>=400 || $status===0) throw new RuntimeException('Proveedor no disponible (HTTP '.$status.', '.$err.')');
 } else {
  $ctx=stream_context_create(['http'=>['timeout'=>$timeout,'header'=>"User-Agent: AgroPlant/2.0\r\nAccept: application/json\r\n"],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
  $raw=@file_get_contents($url,false,$ctx);
  if ($raw===false) throw new RuntimeException('Proveedor externo no disponible');
 }
 $data=json_decode($raw,true);
 if (!is_array($data)) throw new RuntimeException('Respuesta no válida del proveedor');
 return $data;
}
function queryurl(string $base,array $p):string{return $base.'?'.http_build_query($p,'','&',PHP_QUERY_RFC3986);}
function pfloat(string $key,float $min,float $max):float {
 $v=filter_input(INPUT_GET,$key,FILTER_VALIDATE_FLOAT);
 if ($v===null || $v===false || $v<$min || $v>$max) throw new InvalidArgumentException('Coordenadas fuera de México');
 return (float)$v;
}
function payload():array {
 $input=json_decode((string)file_get_contents('php://input'),true);
 if (!is_array($input)) throw new InvalidArgumentException('Datos inválidos');
 return $input;
}
function states():array {
 global $CAT;
 $pdo=db(); if (!$pdo) return $CAT['states'];
 $r=$pdo->query('SELECT codigo AS code,nombre AS name,abreviatura AS abbr,latitud AS lat,longitud AS lon,frase AS phrase FROM estados ORDER BY codigo')->fetchAll();
 return array_map(fn($v)=>array_merge($v,['lat'=>(float)$v['lat'],'lon'=>(float)$v['lon']]),$r);
}
function crops():array {
 global $CAT;
 $pdo=db();if (!$pdo) return $CAT['crops'];
 $sql='SELECT c.slug,c.nombre AS name,c.nombre_cientifico AS scientific_name,c.familia AS `group`,c.temp_min,c.temp_max,c.lluvia_mes_min AS rain_min,c.lluvia_mes_max AS rain_max,c.agua AS water,c.emoji,c.ciclo AS cycle,c.estacion AS season,c.descripcion AS description,c.titulo_wikipedia AS wikipedia_title, i.url_imagen AS photo_url,i.url_google AS google_images_url,i.url_fuente AS photo_source_url,i.licencia AS photo_license FROM cultivos c LEFT JOIN imagenes_cultivo i ON i.id_cultivo=c.id AND i.es_principal=1 WHERE c.activo=1 ORDER BY c.nombre';
 return $pdo->query($sql)->fetchAll();
}
function checkGeo(array $data):?array {
 if (($data['type']??'')==='FeatureCollection' && isset($data['features']) && is_array($data['features'])) return $data;
 if (($data['type']??'')==='Feature') return ['type'=>'FeatureCollection','features'=>[$data]];
 foreach(['data','datos','features','geojson','result','resultado'] as $k) {
  if (!isset($data[$k]) || !is_array($data[$k])) continue;
  if ($k==='features' && array_is_list($data[$k])) return ['type'=>'FeatureCollection','features'=>$data[$k]];
  $nested=checkGeo($data[$k]);if ($nested)return $nested;
 }
 return null;
}
function officialGeo(string $kind,string $state=''):array {
 // Fuente preferente: servicio público de INEGI. Si deja de responder,
 // recurrimos a un espejo comunitario de archivos públicos de INEGI.
 $sources=$kind==='state'
   ? ['https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgee/',
      'https://raw.githubusercontent.com/MacWilliXD/INEGI-geojson/main/geojson_descargas/AGEE.geojson']
   : ['https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/'.$state,
      'https://raw.githubusercontent.com/MacWilliXD/INEGI-geojson/main/geojson_descargas/AGEM_'.$state.'.geojson'];
 $minimum=$kind==='state'?28:1;
 foreach ($sources as $i=>$url) {
  try {
   $geo=checkGeo(remote($url,$i===0?22:35));
   if (!$geo || count($geo['features'])<$minimum) continue;
   $geo['source']=$i===0?'INEGI · servicio oficial':'Copia pública de datos INEGI · espejo comunitario';
   return $geo;
  } catch(Throwable $err) { continue; }
 }
 throw new RuntimeException('Los límites de estados o municipios no están disponibles temporalmente');
}
function monthPower(float $lat,float $lon):array {
 $url='https://power.larc.nasa.gov/api/temporal/climatology/point';
 $base=['community'=>'AG','latitude'=>round($lat,4),'longitude'=>round($lon,4),'format'=>'JSON'];
 $j=null; $rainKey=null;
 foreach (['PRECTOTCORR','IMERG_PRECTOT'] as $k) {
  try {
   $j=remote(queryurl($url,array_merge($base,['parameters'=>'T2M,'.$k.',RH2M'])),35);
   $p=$j['properties']['parameter']??[];
   if (isset($p['T2M'],$p[$k])) {$rainKey=$k;break;}
  } catch(Throwable $e) {continue;}
 }
 if (!$rainKey || !is_array($j)) throw new RuntimeException('NASA POWER no respondió con clima mensual utilizable');
 $p=$j['properties']['parameter']; $months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
 $t=[];$rain=[];$rh=[];
 foreach($months as $i=>$month){
  $tv=$p['T2M'][$month]??null;$rv=$p[$rainKey][$month]??null;
  if (!is_numeric($tv)||!is_numeric($rv)||(float)$tv<=-900||(float)$rv<=-900)throw new RuntimeException('Datos climáticos NASA incompletos');
  $t[]=(float)$tv;
  // Climatología POWER documenta precipitación en mm/día.
  $rain[]=round((float)$rv * cal_days_in_month(CAL_GREGORIAN,$i+1,2025),1);
  $rh[]=(isset($p['RH2M'][$month])&&(float)$p['RH2M'][$month]>-900)?(float)$p['RH2M'][$month]:null;
 }
 return ['source'=>'NASA POWER, climatología histórica','temperature'=>$t,'rainfall'=>$rain,'relative_humidity'=>$rh,'precipitation_unit'=>'mm/mes (convertido de mm/día)','months'=>$months];
}
function suitability(array $crop, array $input,float $temp,float $rain,array $lookup):array {
 $tmin=$crop['temp_min']??null;$tmax=$crop['temp_max']??null;
 $rmin=$crop['rain_min']??null;$rmax=$crop['rain_max']??null;
 if ($tmin===null || $tmax===null || $rmin===null || $rmax===null)
  return ['key'=>$crop['slug'],'name'=>$crop['name'],'score'=>null,'classification'=>'Sin datos suficientes','why'=>'Falta una ficha agronómica revisada para este cultivo.','pros'=>[],'risks'=>['Consulta un técnico agrícola antes de decidir.'],'photo_url'=>$crop['photo_url']??null,'google_images_url'=>$crop['google_images_url']??null,'emoji'=>$crop['emoji']??'🌱'];
 $min=(float)$tmin;$max=(float)$tmax;$rmin=(float)$rmin;$rmax=(float)$rmax;
 $ts=$temp>=$min&&$temp<=$max?100:max(0,100-12*($temp<$min?$min-$temp:$temp-$max));
 $effectiveRain=$rain*(['temporal'=>1,'limitado'=>1.15,'riego'=>1.4][$input['water']??'temporal']??1);
 $rs=$effectiveRain<$rmin?max(0,min(100,100*$effectiveRain/max(1,$rmin))):($rain>$rmax*1.6?max(0,100-0.45*($rain-$rmax*1.6)):100);
 $soil=$input['soil']??'desconocido';$ss=$soil==='desconocido'?65:($soil==='franco'?95:70);
 $prev=$lookup[$input['previous']??'']??null;
 $rot=75;
 if ($prev) {
  if (($input['previous']??'')===$crop['slug'])$rot=35;
  elseif($prev['group']==='cereal' && $crop['group']==='leguminosa')$rot=98;
  elseif($prev['group']==='leguminosa'&&$crop['group']==='cereal')$rot=93;
  elseif($prev['group']===$crop['group'])$rot=62;
 }
 $priority=$input['priority']??'equilibrio';
 $level=$crop['water']??'media';
 if ($priority==='agua')$ps=['baja'=>100,'media'=>74,'alta'=>42][$level]??60;
 elseif($priority==='suelo')$ps=$crop['group']==='leguminosa'?100:67;
 elseif($priority==='riesgo')$ps=['baja'=>90,'media'=>75,'alta'=>52][$level]??65;
 else $ps=76;
 $score=(int)round($ts*.30+$rs*.30+$ss*.15+$rot*.15+$ps*.10);
 $classification=$score>=75?'Positiva':($score>=50?'Intermedia':'Negativa');
 $pros=[];$risks=[];
 if ($ts>=90)$pros[]='Temperatura habitual favorable para este cultivo.';
 else $risks[]='La temperatura habitual puede afectar el desarrollo.';
 if ($rs>=85)$pros[]='Las lluvias de referencia pueden cubrir parte de sus necesidades.';
 else $risks[]='Podría faltar agua durante el cultivo.';
 if ($crop['group']==='leguminosa')$pros[]='Puede ayudar a diversificar y mejorar el manejo del suelo.';
 if ($prev&&$prev['group']===$crop['group'])$risks[]='Sembrar cultivos similares sucesivamente aumenta algunos riesgos.';
 if ($soil==='desconocido')$risks[]='No se conoce el tipo de suelo de la parcela.';
 $risks[]='Falta revisar variedad, plagas, costos y disponibilidad de agua local.';
 return ['key'=>$crop['slug'],'name'=>$crop['name'],'score'=>$score,'classification'=>$classification,
  'why'=>($pros[0]??'Requiere revisión local.'),'pros'=>$pros,'risks'=>$risks,
  'photo_url'=>$crop['photo_url']??null,'google_images_url'=>$crop['google_images_url']??null,'emoji'=>$crop['emoji']??'🌱',
  'factors'=>['temperatura'=>round($ts),'agua'=>round($rs),'suelo'=>round($ss),'rotacion'=>round($rot)]];
}
function analyze(array $in):array {
 $lat=(float)($in['latitude']??0);$lon=(float)($in['longitude']??0);
 if ($lat<14||$lat>33||$lon< -119||$lon> -86) throw new InvalidArgumentException('Elige un punto dentro de México');
 $d=DateTimeImmutable::createFromFormat('!Y-m-d',(string)($in['date']??''));
 if (!$d)throw new InvalidArgumentException('Selecciona una fecha válida');
 $all=crops();$lookup=[];foreach($all as $c)$lookup[$c['slug']]=$c;
 $key=(string)($in['crop']??'');if (!isset($lookup[$key]))throw new InvalidArgumentException('Cultivo desconocido');
 $mo=(int)$d->format('n')-1;
 $power=cache('power_'.round($lat,2).'_'.round($lon,2),86400,fn()=>monthPower($lat,$lon));
 $temp=(float)$power['temperature'][$mo];$rain=(float)$power['rainfall'][$mo];
 $list=[];foreach($all as $c)$list[]=suitability($c,$in,$temp,$rain,$lookup);
 $chosen=next_from($list,$key);
 $options=array_values(array_filter($list,fn($s)=>$s['key']!==$key && $s['score']!==null));
 usort($options,fn($a,$b)=>$b['score']<=>$a['score']);
 $selected=$chosen;
 $alternatives=array_slice($options,0,3);
 // La rotación busca tres familias y no repite incondicionalmente el cultivo elegido.
 $legume=first_of($list,$lookup,fn($c)=>$c['group']==='leguminosa' && $c['slug']!==$key,$key);
 $dry=first_of($list,$lookup,fn($c)=>($c['water']??'')==='baja' && $c['slug']!==$key,$key);
 $cover=first_of($list,$lookup,fn($c)=>in_array($c['slug'],['avena','calabaza','girasol'],true)&&$c['slug']!==$key,$key);
 $rotations=[
  ['title'=>'Como se siembra ahora','cycles'=>array_values(array_filter([$in['previous']??null,$key])),'reason'=>'Sirve como referencia para comparar.'],
  ['title'=>'Para cuidar el suelo','cycles'=>array_values(array_filter([$key,$legume,$cover])),'reason'=>'Alterna familias de cultivos y busca proteger la tierra.'],
  ['title'=>'Para usar menos agua','cycles'=>array_values(array_filter([$key,$dry,$legume])),'reason'=>'Incluye una alternativa de menor demanda de agua.']
 ];
 $r=['mode'=>'real','selected'=>$selected,'alternatives'=>$alternatives,'rotations'=>$rotations,
  'climate'=>['temperature'=>$temp,'rainfall_month'=>$rain,'month'=>(int)$d->format('n'),'monthly'=>$power],
  'source'=>'NASA POWER — antecedentes climáticos mensuales','date_note'=>'Se analiza el mes habitual de siembra, no se predice el clima de ese día.',
  'score_note'=>'Puntuación de demostración con parámetros agrícolas sin validación local. NO es una probabilidad real de cosecha.',
  'limitations'=>'Confirmar en campo: variedad, suelo, precios, plagas, drenaje y disponibilidad real de agua.'];
 $pdo=db();if ($pdo && ($in['save']??false)){
  $s=$pdo->prepare('INSERT INTO analisis(id_cultivo,fecha_siembra,puntaje,clasificacion,fuente_clima,resultado_json) VALUES((SELECT id FROM cultivos WHERE slug=?),?,?,?,?,?)');
  $s->execute([$key,$d->format('Y-m-d'),$selected['score'],$selected['classification'],'NASA POWER',json_encode($r,JSON_UNESCAPED_UNICODE)]);
  $r['saved']=true;
 }
 return $r;
}
function next_from(array $list,string $key):array {
 foreach($list as $s)if($s['key']===$key)return $s;
 throw new InvalidArgumentException('Cultivo no encontrado');
}
function first_of(array $list,array $lookup,callable $test,string $exclude):?string {
 foreach($list as $x)if($x['score']!==null&&$x['key']!==$exclude&&isset($lookup[$x['key']])&&$test($lookup[$x['key']]))return $x['key'];
 return null;
}
function saveMuni(array $geo,string $state):int {
 $pdo=db();if(!$pdo)return 0;
 $stmt=$pdo->prepare('INSERT INTO municipios(codigo,codigo_estado,nombre,latitud,longitud) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre)');
 $n=0;
 foreach($geo['features'] as $f){
  $p=$f['properties']??[];
  $code=(string)($p['CVEGEO']??$p['cvegeo']??$p['CVE_GEO']??'');
  if(!preg_match('/^\d{5}$/',$code) && isset($p['CVE_ENT'],$p['CVE_MUN'])) $code=str_pad((string)$p['CVE_ENT'],2,'0',STR_PAD_LEFT).str_pad((string)$p['CVE_MUN'],3,'0',STR_PAD_LEFT);
  $name=(string)($p['NOMGEO']??$p['nomgeo']??$p['nom_agem']??$p['NOM_MUN']??$p['name']??'');
  if(!preg_match('/^\d{5}$/',$code)||substr($code,0,2)!==$state||$name==='')continue;
  $stmt->execute([$code,$state,mb_substr($name,0,160),null,null]);$n++;
 }
 return $n;
}
try {
 $act=(string)($_GET['a']??'status');
 switch($act) {
 case 'status': out(['ok'=>true,'mariadb'=>db()!==null,'message'=>db()?'Lista para guardar':'Consulta sin guardar; conecta MariaDB para almacenar']);
 case 'states':out(['states'=>states()]);
 case 'crops':out(['crops'=>crops(),'mariadb'=>db()!==null]);
 case 'geo-states':
  try { $geo=cache('inegi_estados',604800,fn()=>officialGeo('state'));$geo['source']=$geo['source']??'INEGI';$geo['approximate']=false;out($geo); }
  catch(Throwable $e){
   $file=$ROOT.'/data/mapa_respaldo_aproximado.geojson';
   $j=json_decode((string)file_get_contents($file),true);$j['approximate']=true;$j['source']='Respaldo aproximado. Límites oficiales no disponibles';out($j);
  }
 case 'geo-municipalities':
  $state=str_pad((string)($_GET['state']??''),2,'0',STR_PAD_LEFT);
  if(!preg_match('/^(0[1-9]|[12][0-9]|3[0-2])$/',$state))throw new InvalidArgumentException('Estado inválido');
  $geo=cache('inegi_municipios_'.$state,604800,fn()=>officialGeo('municipality',$state));
  $count=saveMuni($geo,$state);
  $geo['source']=$geo['source']??'INEGI, división municipal';$geo['saved_municipalities']=$count;out($geo);
 case 'weather':
  $lat=pfloat('lat',14,33);$lon=pfloat('lon',-119,-86);
  $j=cache('meteo_'.round($lat,2).'_'.round($lon,2),900,function()use($lat,$lon){
   return remote(queryurl('https://api.open-meteo.com/v1/forecast',[
    'latitude'=>$lat,'longitude'=>$lon,'timezone'=>'auto',
    'current'=>'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    'daily'=>'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code','forecast_days'=>5]),22);
  });
  out(['source'=>'Open-Meteo, modelo meteorológico','weather'=>$j,'updated_at'=>$j['current']['time']??null]);
 case 'weather-states':
  $all=states();
  $out=cache('meteo_32',1500,function()use($all){
   $j=remote(queryurl('https://api.open-meteo.com/v1/forecast',[
    'latitude'=>implode(',',array_column($all,'lat')),'longitude'=>implode(',',array_column($all,'lon')),
    'current'=>'temperature_2m,relative_humidity_2m,precipitation','timezone'=>'UTC']),35);
   if (!array_is_list($j)||count($j)!==count($all))throw new RuntimeException('No se recibieron datos regionales completos');
   $o=[];foreach($all as $i=>$s){$w=$j[$i]['current']??[];$o[]=['code'=>$s['code'],'temp'=>$w['temperature_2m']??null,'rain'=>$w['precipitation']??null,'humidity'=>$w['relative_humidity_2m']??null,'time'=>$w['time']??null];}
   return $o;
  });
  out(['source'=>'Open-Meteo, un punto por estado (no promedio estatal)','states'=>$out]);
 case 'photo':
  $slug=(string)($_GET['crop']??''); if (!preg_match('/^[a-z0-9_]{1,90}$/',$slug))throw new InvalidArgumentException('Cultivo inválido');
  $crop=next_from(array_map(fn($c)=>['key'=>$c['slug']]+$c,crops()),$slug);
  if (!empty($crop['photo_url']))out(['url'=>$crop['photo_url'],'source'=>$crop['photo_source_url']??null]);
  $title=$crop['wikipedia_title']??null;
  if (!$title) out(['url'=>null]);
  $j=cache('wiki_'.md5($title),86400,fn()=>remote(queryurl('https://en.wikipedia.org/w/api.php',[
   'action'=>'query','format'=>'json','prop'=>'pageimages','piprop'=>'thumbnail','pithumbsize'=>580,'titles'=>$title]),15));
  $page=current($j['query']['pages']??[]);
  $url=is_array($page)?($page['thumbnail']['source']??null):null;
  if($url&&db()){$s=db()->prepare('UPDATE imagenes_cultivo i JOIN cultivos c ON i.id_cultivo=c.id SET i.url_imagen=? WHERE c.slug=? AND i.es_principal=1');$s->execute([$url,$slug]);}
  out(['url'=>$url,'source'=>$crop['photo_source_url']??null]);
 case 'analyze': if($_SERVER['REQUEST_METHOD']!=='POST')out(['error'=>'Se requiere POST'],405);out(analyze(payload()));
 case 'add-crop':
  if($_SERVER['REQUEST_METHOD']!=='POST')out(['error'=>'Se requiere POST'],405);
  $pdo=db();if(!$pdo)out(['error'=>'Primero conecta MariaDB para añadir cultivos.'],503);
  $input=payload();$name=trim((string)($input['name']??''));
  if(mb_strlen($name)<2||mb_strlen($name)>110)throw new InvalidArgumentException('Escribe el nombre del cultivo');
  $slug='personalizado_'.bin2hex(random_bytes(5));
  $s=$pdo->prepare('INSERT INTO cultivos(slug,nombre,familia,agua,emoji,ciclo,estacion,descripcion) VALUES(?,?,?, ?,?,?,?,?)');
  $s->execute([$slug,$name,'por_clasificar','pendiente','🌱','Por confirmar','Por confirmar','Cultivo registrado. Requiere ficha técnica antes de recibir puntuación.']);
  $id=(int)$pdo->lastInsertId();
  $url='https://www.google.com/search?'.http_build_query(['tbm'=>'isch','q'=>$name.' cultivo planta']);
  $pdo->prepare('INSERT INTO imagenes_cultivo(id_cultivo,url_google,licencia) VALUES(?,?,?)')->execute([$id,$url,'Fotos de búsqueda; derechos de sus autores']);
  out(['ok'=>true,'slug'=>$slug,'message'=>'Cultivo agregado. La evaluación requiere datos de cultivo.']);
 default:out(['error'=>'Ruta desconocida'],404);
 }
} catch(InvalidArgumentException $e){out(['error'=>$e->getMessage()],422);}
catch(Throwable $e){out(['error'=>'No fue posible obtener los datos solicitados.','detail'=>$e->getMessage()],503);}
