import asyncio,base64,json
from pathlib import Path
from app.db import Database,now
from app.live import LiveRuntime
from app.runner import Runner

PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=')

def test_browser_steps_import_actual_captures_and_ignore_outside_files(tmp_path,monkeypatch):
    workspace=tmp_path/'shared';workspace.mkdir();monkeypatch.setenv('CURDR_WORKSPACE_DIR',str(workspace))
    db=Database(tmp_path/'browser.db');runtime=LiveRuntime(db,Runner())
    async def scenario():
        await runtime.event({'event':'run.created','run_id':'menu','input_preview':'Inspect the menu'},'food')
        await runtime.event({'event':'tool.started','run_id':'menu','tool':'browser_exec','tool_call_id':'b1','preview':'Open https://restaurant.example/menu?token=private'},'food')
        assert db.get('runs','menu')['browser']['url']=='https://restaurant.example/menu'
        image=workspace/'page.png';image.write_bytes(PNG)
        await runtime.event({'event':'tool.completed','run_id':'menu','tool':'browser_exec','tool_call_id':'b1','preview':json.dumps({'screenshot_path':str(image)})},'food')
        run=db.get('runs','menu');file=db.get('files',run['browser']['fileId'])
        assert file['previewKind']=='browser' and base64.b64decode(file['base64'])==PNG and file['channel']=='food'
        outside=tmp_path/'private.png';outside.write_bytes(PNG)
        await runtime.event({'event':'run.created','run_id':'other'},'food')
        await runtime.event({'event':'tool.completed','run_id':'other','tool':'browser_exec','preview':json.dumps({'screenshot_path':str(outside)})},'food')
        assert not db.get('runs','other')['browser'].get('fileId')
    asyncio.run(scenario());db.conn.close()
