"""State survives restarts and two client decisions cannot consume one approval twice."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from fastapi.testclient import TestClient
from app.db import Database
from app.main import create_app


def test_restart_recovery_preserves_files_and_pauses_running_work(tmp_path):
    path=str(tmp_path/'state.db')
    db=Database(path)
    db.event('task_update',dict(id='t',title='Test',channel='inbox',status='run'))
    db.event('file_added',dict(id='f',name='out.md',content='durable'))
    db.conn.close()
    db=Database(path)
    assert db.get('tasks','t')['status']=='need'
    assert db.get('files','f')['content']=='durable'
    db.conn.close()


def test_two_decisions_only_one_succeeds(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    app=create_app(str(tmp_path/'state.db'))
    db=app.state.db
    db.event('task_update',dict(id='t',title='Test',channel='inbox',status='up'))
    db.event('approval',dict(id='a',taskId='t',kind='delete',title='Delete',state='pending',expiresAt=(datetime.now(timezone.utc)+timedelta(minutes=1)).isoformat()))
    with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
        with ThreadPoolExecutor(2) as pool:
            responses=list(pool.map(lambda _:client.post('/approval/a',json={'decision':'approve'}).status_code,range(2)))
        assert sorted(responses)==[200,409]
