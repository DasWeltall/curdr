"""Single-owner SQLite state and durable event log. Run one Uvicorn worker."""
import json
import os
import sqlite3
import threading
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4


def now():
    return datetime.now(timezone.utc).isoformat()


def uid():
    return uuid4().hex


AGENT_DEFAULTS=dict(name='curdr',shape='fluid',color='#9AAEFA',eyes='round',mouth='smile',accessory='none',motion='float',eyeColor='#252B3A',accessoryColor='#252B3A',eyeSize=100,spacing=0,roundness=75,shapeSeed=42,antenna=True,expression='idle')
DEFAULTS = dict(founderProfile={},founderInterviewDone=False,morningPrompt='',checkPrompt='',timezone='Europe/Berlin',userMessageColor='',agentMessageColor='',replyLanguage='auto',proactiveChecks=False,proactiveInterval=60,briefingEnabled=False,hermesModel='',hermesProvider='',name='', onboarded=False, pic='', icon='character',agent=AGENT_DEFAULTS, theme='system', fs=1, calm=False,
                ton='kurz', pro='aktiv', brief='07:00', quiet=True, sleeping=False,
                model='openai/gpt-4.1-mini', budget=20, used=0,
                aPay=True, aSend=True, aDel=True, sbx=True, filesystem=False,
                network=False, browser=False,
                apps=dict(Gmail=False, Kalender=False, Drive=False, Notion=False))


class Database:
    def __init__(self, path, recover=True):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        os.chmod(path,0o660)
        self.conn.execute('PRAGMA journal_mode=DELETE')
        self.conn.execute('PRAGMA busy_timeout=5000')
        self.conn.executescript('''
        CREATE TABLE IF NOT EXISTS objects(kind TEXT,id TEXT,data TEXT,PRIMARY KEY(kind,id));
        CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,data TEXT);
        CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY,data TEXT,created REAL,task_id TEXT);
        CREATE TABLE IF NOT EXISTS spend(month TEXT PRIMARY KEY,reserved REAL NOT NULL);
        ''')
        saved=self.get('settings','main')
        if not saved:
            self.put('settings','main',DEFAULTS)
        elif 'agent' not in saved:
            self.put('settings','main',{**DEFAULTS,**saved,'icon':'character','agent':AGENT_DEFAULTS})
        current=self.get('settings','main')
        current={**DEFAULTS,**current}
        self.put('settings','main',current)
        if current.get('agent',{}).get('name')=='AgentX':
            current['agent']['name']='curdr'
            self.put('settings','main',current)
        # A restart cannot silently leave an orphaned task marked as running.
        for task in self.all('tasks') if recover else []:
            if task['status'] == 'run':
                self.event('task_update', {**task, 'status': 'need', 'summary': 'Server restarted. Please start again.'})

    def get(self, kind, id):
        with self.lock:
            row = self.conn.execute('SELECT data FROM objects WHERE kind=? AND id=?', (kind, id)).fetchone()
            return json.loads(row[0]) if row else None

    def all(self, kind):
        with self.lock:
            return [json.loads(r[0]) for r in self.conn.execute('SELECT data FROM objects WHERE kind=? ORDER BY rowid', (kind,))]

    def put(self, kind, id, data):
        self.conn.execute('INSERT OR REPLACE INTO objects VALUES (?,?,?)', (kind, id, json.dumps(data, ensure_ascii=False)))

    def event(self, type, data):
        with self.lock:
            self.conn.execute('BEGIN IMMEDIATE')
            try:
                if type in ('message', 'task_update', 'file_added', 'approval'):
                    kind = dict(message='messages', task_update='tasks', file_added='files', approval='approvals')[type]
                    self.put(kind, data['id'], data)
                elif type == 'task_removed':
                    self.conn.execute('DELETE FROM objects WHERE kind="tasks" AND id=?', (data['id'],))
                elif type == 'channels':
                    for channel in data:
                        self.put('channels',channel['id'],channel)
                elif type == 'run':
                    self.put('runs',data['id'],data)
                elif type == 'hermes':
                    self.put('meta','hermes',data)
                elif type == 'activity':
                    self.put('meta','activity',data)
                elif type == 'settings':
                    self.put('settings', 'main', data)
                elif type == 'skills':
                    self.conn.execute('DELETE FROM objects WHERE kind="skills"')
                    for skill in data:
                        self.put('skills', skill['id'], skill)
                elif type == 'log':
                    self.put('logs', uid(), dict(text=data))
                event = dict(type=type, data=data)
                cursor = self.conn.execute('INSERT INTO events(data) VALUES (?)', (json.dumps(event, ensure_ascii=False),))
                self.conn.execute('COMMIT')
                return cursor.lastrowid
            except BaseException:
                self.conn.execute('ROLLBACK')
                raise

    def message(self, text, channel='main', role='agent'):
        m = dict(id=uid(), role=role, kind='text', text=text, channel=channel, createdAt=now())
        self.event('message', m)
        return m

    def snapshot(self):
        with self.lock:
            state = {k: self.all(k) for k in ('tasks', 'files', 'messages', 'approvals', 'skills', 'channels','runs')}
            state['hermes']=self.get('meta','hermes')
            state.update(settings=self.get('settings', 'main'), iconState='work' if any(t['status']=='run' for t in state['tasks']) else 'idle', logs=[l['text'] for l in self.all('logs')][-100:])
            activity=self.get('meta','activity') or {}
            state['activityChannel']=activity.get('channel','main')
            seq = self.conn.execute('SELECT COALESCE(MAX(seq),0) FROM events').fetchone()[0]
            return state, seq

    def events_after(self, seq):
        with self.lock:
            return self.conn.execute('SELECT seq,data FROM events WHERE seq>? ORDER BY seq LIMIT 100', (seq,)).fetchall()
