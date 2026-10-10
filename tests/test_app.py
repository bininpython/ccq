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

if __name__=='__main__':unittest.main()
