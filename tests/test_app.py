import unittest, tempfile, os, sqlite3
from datetime import datetime, timedelta
from server import app

class TestCCQ(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();app.DB=os.path.join(self.temp.name,'test.db');app.init()
    def tearDown(self):self.temp.cleanup()
    def replacement(self,**extra):
        return dict(roll_id=0,version=0,occurred=(datetime.now(app.TZ)-timedelta(minutes=1)).isoformat(),serial='RF-001',reason='Preventiva',diameter=850,notes='Teste',**extra)
    def test_thresholds(self):
        for d,c in [(0,'green'),(5,'green'),(6,'yellow'),(10,'yellow'),(11,'red'),(99,'red'),(None,'unknown')]:self.assertEqual(app.color(d),c)
    def test_calendar_day_timezone(self):
        self.assertEqual(app.age('2026-10-05T23:59:00-03:00',datetime(2026,10,11,0,1,tzinfo=app.TZ)),6)
    def test_shifts(self):
        for hour,s in [(0,'TN'),(6,'TN'),(7,'TM'),(14,'TM'),(15,'TT'),(22,'TT'),(23,'TN')]:self.assertEqual(app.shift(datetime(2026,1,1,hour)),s)
    def test_initial_state_unknown(self):
        with app.connect() as db:
            rows=db.execute('SELECT * FROM rolls').fetchall()
        self.assertEqual(len(rows),5);self.assertTrue(all(r['installed'] is None for r in rows))
    def test_swap_preserves_history_and_detects_conflict(self):
        data=self.replacement();app.mutate('/api/replacements',data,'Abner')
        with self.assertRaises(ValueError):app.mutate('/api/replacements',data,'Outro')
        data.update(version=1,serial='RF-002',occurred=datetime.now(app.TZ).isoformat())
        app.mutate('/api/replacements',data,'Outro')
        with app.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM events').fetchone()[0],2)
            row=db.execute("SELECT * FROM events WHERE serial='RF-002'").fetchone()
            self.assertEqual(row['old_serial'],'RF-001')
    def test_replacement_without_serial(self):
        data=self.replacement();del data['serial'];app.mutate('/api/replacements',data,'Abner')
        with app.connect() as db:
            self.assertEqual(db.execute('SELECT serial FROM events').fetchone()[0],'')
            self.assertIsNone(db.execute('SELECT serial FROM rolls WHERE id=0').fetchone()[0])
    def test_future_rejected(self):
        data=self.replacement();data['occurred']=(datetime.now(app.TZ)+timedelta(days=1)).isoformat()
        with self.assertRaises(ValueError):app.mutate('/api/replacements',data,'Abner')
    def test_inspection_creates_task_and_audit(self):
        data=dict(roll_id=2,occurred=datetime.now(app.TZ).isoformat(),checks={k:'ok' for k in app.CHECKS},notes='Vibração excessiva')
        data['checks']['Vibração']='issue';app.mutate('/api/inspections',data,'Abner')
        with app.connect() as db:task=dict(db.execute('SELECT * FROM tasks').fetchone())
        app.mutate('/api/tasks/status',dict(id=task['id'],status='progress',expected='pending'),'Maria')
        with self.assertRaises(ValueError):app.mutate('/api/tasks/status',dict(id=task['id'],status='done',expected='pending'),'João')
        with app.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM audit').fetchone()[0],1)
    def test_incomplete_checklist_rejected(self):
        with self.assertRaises(ValueError):app.mutate('/api/inspections',dict(roll_id=0,occurred=datetime.now(app.TZ).isoformat(),checks={}),'Abner')
    def test_anomaly_requires_note(self):
        with self.assertRaises(ValueError):app.mutate('/api/inspections',dict(roll_id=0,occurred=datetime.now(app.TZ).isoformat(),checks={k:'issue' for k in app.CHECKS}),'Abner')

    def stock_in(self,**extra):
        data=dict(place='retifica',slot=1,version=0,occurred=(datetime.now(app.TZ)-timedelta(minutes=5)).isoformat(),code='RC-01',perimeter=377.0,diameter=120,condition=app.STOCK_CONDITIONS[0],notes='')
        data.update(extra);return data
    def test_stock_trays_have_four_empty_slots_each(self):
        with app.connect() as db:rows=db.execute('SELECT * FROM stock_slots ORDER BY place,slot').fetchall()
        self.assertEqual([(r['place'],r['slot']) for r in rows],[('rb1',1),('rb1',2),('rb1',3),('rb1',4),('retifica',1),('retifica',2),('retifica',3),('retifica',4)])
        self.assertTrue(all(r['entered'] is None for r in rows))
    def test_rb1_and_retifica_are_independent(self):
        app.mutate('/api/stock/in',self.stock_in(),'Rafael')
        app.mutate('/api/stock/in',self.stock_in(place='rb1',code='RB-01'),'Davi')
        with self.assertRaises(ValueError):app.mutate('/api/stock/in',self.stock_in(place='outro'),'Davi')
        with app.connect() as db:rows={(r['place'],r['slot']):r['code'] for r in db.execute('SELECT * FROM stock_slots WHERE entered IS NOT NULL')}
        self.assertEqual(rows,{('retifica',1):'RC-01',('rb1',1):'RB-01'})
    def test_migrates_first_version_stock(self):
        with app.connect() as db:
            db.executescript('''CREATE TABLE stock(slot INTEGER PRIMARY KEY, code TEXT, perimeter REAL, diameter REAL, condition TEXT, entered TEXT, operator TEXT, notes TEXT, version INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE stock_moves(id TEXT PRIMARY KEY, slot INTEGER NOT NULL REFERENCES stock(slot), action TEXT NOT NULL, code TEXT, perimeter REAL, diameter REAL, condition TEXT, destination TEXT, operator TEXT NOT NULL, shift TEXT NOT NULL, occurred TEXT NOT NULL, recorded TEXT NOT NULL, notes TEXT);
            DELETE FROM stock_slots;''')
            for slot in range(1,5):db.execute('INSERT INTO stock(slot) VALUES(?)',(slot,))
            db.execute("UPDATE stock SET code='OLD',perimeter=370,condition='Em inspeção',entered='2026-11-01T08:00:00-03:00',operator='Ana',version=1 WHERE slot=3")
            db.execute("INSERT INTO stock_moves VALUES('m1',3,'entrada','OLD',370,NULL,'Em inspeção',NULL,'Ana','TM','2026-11-01T08:00:00-03:00','2026-11-01T08:00:00-03:00','')")
        app.init()
        with app.connect() as db:
            self.assertEqual(db.execute("SELECT code FROM stock_slots WHERE place='retifica' AND slot=3").fetchone()[0],'OLD')
            self.assertEqual(db.execute("SELECT place FROM stock_log WHERE id='m1'").fetchone()[0],'retifica')
            self.assertEqual(db.execute("SELECT count(*) FROM stock_slots WHERE place='rb1'").fetchone()[0],4)
            self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='stock'").fetchone())
    def test_stock_in_and_out_keeps_history(self):
        app.mutate('/api/stock/in',self.stock_in(),'Rafael')
        with self.assertRaises(ValueError):app.mutate('/api/stock/in',self.stock_in(version=1),'Outro')
        app.mutate('/api/stock/out',dict(place='retifica',slot=1,version=1,occurred=datetime.now(app.TZ).isoformat(),destination='Instalado no forno · posição 2'),'Davi')
        with app.connect() as db:
            slot=db.execute("SELECT * FROM stock_slots WHERE place='retifica' AND slot=1").fetchone();moves=db.execute('SELECT * FROM stock_log ORDER BY occurred').fetchall()
        self.assertIsNone(slot['entered']);self.assertEqual(slot['version'],2)
        self.assertEqual([m['action'] for m in moves],['entrada','saida']);self.assertEqual(moves[1]['perimeter'],377.0);self.assertEqual(moves[1]['code'],'RC-01')
    def test_stock_validation(self):
        for bad in [dict(perimeter=None),dict(perimeter=0),dict(perimeter='300'),dict(condition='Qualquer'),dict(slot=5),dict(version=3)]:
            with self.assertRaises(ValueError):app.mutate('/api/stock/in',self.stock_in(**bad),'Rafael')
        with self.assertRaises(ValueError):app.mutate('/api/stock/out',dict(place='retifica',slot=2,version=0,occurred=datetime.now(app.TZ).isoformat(),destination='Sucata'),'Rafael')

if __name__=='__main__':unittest.main()
