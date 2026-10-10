"""CCQ: API e servidor estático; Python 3.12+, sem dependências externas."""
import os, json, sqlite3, secrets, math
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = Path(__file__).resolve().parent.parent
DB = os.getenv('CCQ_DB', str(ROOT / 'data' / 'ccq.sqlite3'))
TZ = ZoneInfo('America/Sao_Paulo')
CHECKS = ['Superfície do rolo', 'Ruído anormal', 'Vibração', 'Alinhamento da tira', 'Mancais e refrigeração']

def connect():
    db = sqlite3.connect(DB, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db

def init():
    Path(DB).parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS rolls(id INTEGER PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL, serial TEXT, diameter REAL, installed TEXT, version INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, roll_id INTEGER NOT NULL REFERENCES rolls(id), operator TEXT NOT NULL, shift TEXT NOT NULL, occurred TEXT NOT NULL, recorded TEXT NOT NULL, reason TEXT NOT NULL, serial TEXT NOT NULL, old_serial TEXT, diameter REAL, notes TEXT);
        CREATE TABLE IF NOT EXISTS inspections(id TEXT PRIMARY KEY, roll_id INTEGER NOT NULL REFERENCES rolls(id), operator TEXT NOT NULL, shift TEXT NOT NULL, occurred TEXT NOT NULL, checks TEXT NOT NULL, notes TEXT);
        CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, roll_id INTEGER NOT NULL REFERENCES rolls(id), title TEXT NOT NULL, status TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL, operator TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, task_id TEXT NOT NULL, operator TEXT NOT NULL, old_status TEXT, new_status TEXT NOT NULL, occurred TEXT NOT NULL);
        ''')
        for i in range(5):
            db.execute('INSERT OR IGNORE INTO rolls(id,name,location) VALUES(?,?,?)', (i, f'Rolo {i}', 'Externo · entrada' if i == 0 else f'Forno · posição {i}'))

def now(): return datetime.now(TZ).isoformat()
def age(installed, current=None):
    if not installed: return None
    return max(0, ((current or datetime.now(TZ)).date() - datetime.fromisoformat(installed).astimezone(TZ).date()).days)
def color(days): return 'unknown' if days is None else 'green' if days <= 5 else 'yellow' if days <= 10 else 'red'
def shift(dt): return 'TN' if dt.hour >= 23 or dt.hour < 7 else 'TM' if dt.hour < 15 else 'TT'
def required(data, key, limit=500):
    value = data.get(key)
    if not isinstance(value, str) or not value.strip() or len(value) > limit: raise ValueError(f'Preencha corretamente: {key}.')
    return value.strip()
def occurred(data):
    value = required(data, 'occurred', 50)
    dt = datetime.fromisoformat(value)
    if not dt.tzinfo: raise ValueError('Data deve incluir fuso horário.')
    if dt > datetime.now(TZ): raise ValueError('Não é permitido registrar uma data futura.')
    return dt.astimezone(TZ)

def mutate(path, data, operator):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        if path == '/api/tasks/status':
            status = data.get('status')
            if status not in ['pending','progress','done']: raise ValueError('Etapa inválida.')
            task = db.execute('SELECT * FROM tasks WHERE id=?',(data.get('id'),)).fetchone()
            if not task: raise ValueError('Atividade não encontrada.')
            if task['status'] != data.get('expected'): raise ValueError('Atividade alterada por outro operador. Atualize a tela.')
            db.execute('UPDATE tasks SET status=?,updated=?,operator=? WHERE id=?',(status,now(),operator,task['id']))
            db.execute('INSERT INTO audit(task_id,operator,old_status,new_status,occurred) VALUES(?,?,?,?,?)',(task['id'],operator,task['status'],status,now()))
            return
        roll = db.execute('SELECT * FROM rolls WHERE id=?',(data.get('roll_id'),)).fetchone()
        if not roll: raise ValueError('Posição inválida.')
        if path == '/api/replacements':
            dt = occurred(data)
            if data.get('version') != roll['version']: raise ValueError('Este rolo foi atualizado. Recarregue antes de registrar.')
            if roll['installed'] and dt <= datetime.fromisoformat(roll['installed']): raise ValueError('A troca deve ser posterior à última instalação.')
            serial = required(data,'serial',100)
            reason = required(data,'reason',200)
            diameter = data.get('diameter')
            if diameter is not None and (not isinstance(diameter,(int,float)) or not math.isfinite(diameter) or not 0 < diameter < 10000): raise ValueError('Diâmetro inválido.')
            notes = str(data.get('notes',''))[:2000]
            db.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?,?)',(secrets.token_hex(12),roll['id'],operator,shift(dt),dt.isoformat(),now(),reason,serial,roll['serial'],diameter,notes))
            db.execute('UPDATE rolls SET installed=?,serial=?,diameter=?,version=version+1 WHERE id=?',(dt.isoformat(),serial,diameter,roll['id']))
        elif path == '/api/inspections':
            dt = occurred(data)
            checks = data.get('checks',{})
            if set(checks) != set(CHECKS) or any(v not in ['ok','issue','na'] for v in checks.values()): raise ValueError('Responda todos os itens do checklist.')
            notes = str(data.get('notes','')).strip()[:2000]
            if 'issue' in checks.values() and not notes: raise ValueError('Descreva a anomalia identificada.')
            db.execute('INSERT INTO inspections VALUES(?,?,?,?,?,?,?)',(secrets.token_hex(12),roll['id'],operator,shift(dt),dt.isoformat(),json.dumps(checks,ensure_ascii=False),notes))
            if 'issue' in checks.values():
                title = 'Inspeção: ' + ', '.join(k for k,v in checks.items() if v == 'issue') + ' — ' + notes
                db.execute('INSERT INTO tasks VALUES(?,?,?,?,?,?,?)',(secrets.token_hex(12),roll['id'],title,'pending',now(),now(),operator))
        elif path == '/api/tasks':
            db.execute('INSERT INTO tasks VALUES(?,?,?,?,?,?,?)',(secrets.token_hex(12),roll['id'],required(data,'title',2000),'pending',now(),now(),operator))
        else: raise ValueError('Operação desconhecida.')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
    def send_json(self,status,value,cookie=None):
        body=json.dumps(value,ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body)))
        if cookie: self.send_header('Set-Cookie',cookie)
        self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path.startswith('/api/'):
            if self.path != '/api/state':return self.send_json(404,{'error':'Não encontrado.'})
            with connect() as db:
                result={table:[dict(r) for r in db.execute(f'SELECT * FROM {table}'+(' ORDER BY occurred DESC' if table in ['events','inspections','audit'] else ''))] for table in ['rolls','events','inspections','tasks','audit']}
            for r in result['rolls']: r.update(days=age(r['installed']),status=color(age(r['installed'])))
            result['server_time']=now()
            return self.send_json(200,result)
        return super().do_GET()
    def do_POST(self):
        # Custom header prevents cross-site form submissions; no permissive CORS.
        if self.headers.get('X-CCQ-Request') != '1':return self.send_json(403,{'error':'Requisição inválida.'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0 < size <= 16000:raise ValueError('Tamanho inválido.')
            data=json.loads(self.rfile.read(size))
            if not isinstance(data,dict):raise ValueError('Dados inválidos.')
            operator=required(data,'operator',100)
            mutate(self.path,data,operator)
            self.send_json(200,{'ok':True})
        except (ValueError,TypeError,KeyError) as e:self.send_json(400,{'error':str(e)})
        except Exception:
            import traceback; traceback.print_exc()
            self.send_json(500,{'error':'Não foi possível salvar. Tente novamente.'})

if __name__=='__main__':
    init()
    print('CCQ disponível na porta '+os.getenv('PORT','8000'),flush=True)
    ThreadingHTTPServer(('0.0.0.0',int(os.getenv('PORT','8000'))),Handler).serve_forever()
