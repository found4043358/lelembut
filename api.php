<?php
header('Content-Type: application/json');

$dbFile = __DIR__ . '/levels.sqlite';
$pdo = new PDO('sqlite:' . $dbFile);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Initialize tables
$pdo->exec("CREATE TABLE IF NOT EXISTS levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data TEXT NOT NULL
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL
)");

// Seeding Function
function seedLevels($pdo) {
    $stmt = $pdo->query("SELECT COUNT(*) FROM levels");
    if ($stmt->fetchColumn() == 0) {
        $TS = 40;
        
        // Helper to make blank tiles
        $makeTiles = function($cols, $rows, $groundH) use ($TS) {
            $t = [];
            for($y=0; $y<$rows; $y++){
                $t[$y] = [];
                for($x=0; $x<$cols; $x++){
                    $t[$y][$x] = ($y >= $rows - $groundH) ? 1 : 0;
                }
            }
            return $t;
        };

        // --- LEVEL 1 (MUDAH) ---
        $t1 = $makeTiles(100, 15, 2);
        // Add some platforms
        for($i=10; $i<15; $i++) $t1[10][$i] = 2; // Plat
        for($i=25; $i<30; $i++) $t1[9][$i] = 2; // Plat
        $l1 = [
            'cols'=>100, 'rows'=>15, 'tiles'=>$t1,
            'pickups'=>[
                ['t'=>'ammo', 'amt'=>10, 'x'=>12*$TS, 'y'=>8*$TS],
                ['t'=>'hp', 'amt'=>50, 'x'=>27*$TS, 'y'=>7*$TS]
            ],
            'doors'=>[ ['wx'=>90*$TS, 'wy'=>13*$TS, 'ri'=>0] ],
            'enemies'=>[ ['x'=>40*$TS, 'y'=>13*$TS], ['x'=>70*$TS, 'y'=>13*$TS] ],
            'spawnX'=> 2*$TS, 'spawnY'=> 12*$TS
        ];

        // --- LEVEL 2 (MENENGAH) ---
        $t2 = $makeTiles(150, 15, 2);
        // Pits
        for($i=20; $i<25; $i++) { $t2[13][$i]=0; $t2[14][$i]=0; }
        for($i=45; $i<52; $i++) { $t2[13][$i]=0; $t2[14][$i]=0; }
        // Spikes
        for($i=35; $i<40; $i++) $t2[12][$i]=3;
        // Platforms over pits
        for($i=46; $i<51; $i++) $t2[10][$i]=2;
        
        $l2 = [
            'cols'=>150, 'rows'=>15, 'tiles'=>$t2,
            'pickups'=>[
                ['t'=>'ammo', 'amt'=>5, 'x'=>48*$TS, 'y'=>8*$TS],
            ],
            'doors'=>[ ['wx'=>140*$TS, 'wy'=>13*$TS, 'ri'=>0] ],
            'enemies'=>[ ['x'=>30*$TS, 'y'=>13*$TS], ['x'=>60*$TS, 'y'=>13*$TS], ['x'=>90*$TS, 'y'=>13*$TS], ['x'=>100*$TS, 'y'=>13*$TS] ],
            'spawnX'=> 2*$TS, 'spawnY'=> 12*$TS
        ];

        // --- LEVEL 3 (SULIT) ---
        $t3 = $makeTiles(200, 15, 2);
        // Pits & Spikes everywhere
        for($i=15; $i<22; $i++) { $t3[13][$i]=0; $t3[14][$i]=0; } // Pit
        $t3[11][18] = 2; $t3[11][19] = 2; // Jump plat
        
        for($i=30; $i<60; $i++) $t3[12][$i]=3; // Long spike field
        for($i=32; $i<35; $i++) $t3[9][$i]=2;
        for($i=42; $i<45; $i++) $t3[7][$i]=2;
        for($i=52; $i<55; $i++) $t3[9][$i]=2;

        $l3 = [
            'cols'=>200, 'rows'=>15, 'tiles'=>$t3,
            'pickups'=>[
                ['t'=>'ammo', 'amt'=>5, 'x'=>43*$TS, 'y'=>5*$TS],
            ],
            'doors'=>[ ['wx'=>190*$TS, 'wy'=>13*$TS, 'ri'=>0] ],
            'enemies'=>[ ['x'=>25*$TS, 'y'=>13*$TS], ['x'=>65*$TS, 'y'=>13*$TS], ['x'=>70*$TS, 'y'=>13*$TS], ['x'=>75*$TS, 'y'=>13*$TS], ['x'=>80*$TS, 'y'=>13*$TS] ],
            'spawnX'=> 2*$TS, 'spawnY'=> 12*$TS
        ];

        $ins = $pdo->prepare("INSERT INTO levels (name, data) VALUES (?, ?)");
        $ins->execute(['Level 1 (Mudah)', json_encode($l1)]);
        $ins->execute(['Level 2 (Menengah)', json_encode($l2)]);
        $ins->execute(['Level 3 (Sulit)', json_encode($l3)]);
    }
}
seedLevels($pdo);

$action = $_GET['action'] ?? '';

try {
    if ($action === 'list') {
        $stmt = $pdo->query("SELECT id, name FROM levels ORDER BY id ASC");
        $levels = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'levels' => $levels]);
    } 
    elseif ($action === 'load') {
        $id = $_GET['id'] ?? 0;
        $stmt = $pdo->prepare("SELECT * FROM levels WHERE id = ?");
        $stmt->execute([$id]);
        $level = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($level) {
            $level['data'] = json_decode($level['data']);
            echo json_encode(['success' => true, 'level' => $level]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Level not found']);
        }
    } 
    elseif ($action === 'save') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) { echo json_encode(['success' => false, 'message' => 'Invalid JSON input']); exit; }
        
        $name = $input['name'] ?? 'Untitled Level';
        $data = json_encode($input['data'] ?? []);
        $id = $input['id'] ?? null;

        if ($id) {
            $stmt = $pdo->prepare("UPDATE levels SET name = ?, data = ? WHERE id = ?");
            $stmt->execute([$name, $data, $id]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO levels (name, data) VALUES (?, ?)");
            $stmt->execute([$name, $data]);
            $id = $pdo->lastInsertId();
        }
        
        echo json_encode(['success' => true, 'id' => $id, 'message' => 'Level saved']);
    } 
    elseif ($action === 'settings_save') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) { echo json_encode(['success' => false, 'message' => 'Invalid JSON input']); exit; }
        
        $data = json_encode($input['data'] ?? []);
        
        $stmt = $pdo->query("SELECT COUNT(*) FROM settings");
        if ($stmt->fetchColumn() == 0) {
            $stmt = $pdo->prepare("INSERT INTO settings (id, data) VALUES (1, ?)");
            $stmt->execute([$data]);
        } else {
            $stmt = $pdo->prepare("UPDATE settings SET data = ? WHERE id = 1");
            $stmt->execute([$data]);
        }
        echo json_encode(['success' => true, 'message' => 'Settings saved']);
    }
    elseif ($action === 'settings_load') {
        $stmt = $pdo->query("SELECT data FROM settings WHERE id = 1");
        $settings = $stmt->fetchColumn();
        if ($settings) {
            echo json_encode(['success' => true, 'settings' => json_decode($settings)]);
        } else {
            echo json_encode(['success' => false, 'message' => 'No settings found']);
        }
    }
    else {
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
