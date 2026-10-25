import contextlib
import json
import os
import sys

# The pinned upstream runs from /opt/hermes in the official Docker build.
sys.path.insert(0,'/opt/hermes')
request=json.loads(sys.stdin.read())
from pathlib import Path
import re
channel=request.get('channel','main')
if not re.fullmatch(r'[a-z0-9_-]{1,48}',channel): raise ValueError('Invalid workspace.')
home=Path('/opt/data/channels')/channel
home.mkdir(parents=True,exist_ok=True)
os.environ['HERMES_HOME']=str(home)
with contextlib.redirect_stdout(sys.stderr):
    from run_agent import AIAgent
    agent=AIAgent(base_url='http://model-proxy:8091/v1',api_key='proxy-managed',
                  provider='custom',api_mode='chat_completions',model=request['model'],
                  enabled_toolsets=["memory","skills"],max_iterations=10,max_tokens=4096,quiet_mode=True,
                  skip_context_files=True,skip_memory=False,skip_background_review=True,
                  save_trajectories=False,run_budget_seconds=90)
    # A fail-closed assertion catches upstream changes to tool-selection semantics.
    allowed={'memory','skills_list','skill_view','skill_manage'}
    if any(t['function']['name'] not in allowed for t in agent.tools):
        raise RuntimeError('Unexpected tool in the curdr memory/skills runtime')
    instruction=('You are a focused personal assistant in curdr. Reply in the user’s language unless asked otherwise. '
                 'You may maintain your own memory and learned skill documents. '
                 'Do not execute external actions or claim actions have been executed. '
                 'Never invent results. Ask when essential context is missing. '
                 'Be '+('concise.' if request['style']=='kurz' else 'thorough.'))
    instruction+='\n'+request.get('workspace','')
    if request['purpose'] in ('chat','briefing','proactive'):
        instruction+='\nUse native curdr visualizations proactively without waiting to be asked. Default to a short checklist for plans/priorities, a small table for choices, metrics for verified progress, a calculator for what-if inputs, and a chart for actual numeric trends. Prefer one compact card with one or two blocks and at most five items instead of a prose list. Do not duplicate it in a long explanation. Simple conversation needs no card. Explain briefly, then emit exactly one fenced curdr JSON block. Do not invent facts or data; ask for missing inputs. No HTML, JS, URLs or code. Schema: {"title":"Short title","description":"Short description","blocks":[...]} with 1-8 blocks. Allowed blocks: {"type":"metrics","items":[{"label":"Name","value":"Value"}]}; {"type":"chart","kind":"bar" or "line","title":"Title","labels":["A","B"],"series":[{"name":"Series","values":[1,2]}]}; {"type":"table","columns":["Name","Value"],"rows":[["A",1]]}; {"type":"checklist","items":[{"text":"Task","done":false}]}; {"type":"calculator","label":"Quantity","min":0,"max":100,"step":1,"value":10,"multiplier":5,"offset":0,"unit":"$","resultLabel":"Total"}; {"type":"text","text":"Short note"}. Calculator result = input*multiplier+offset. At most 24 chart points, four series, six table columns and 30 rows. Use valid finite numbers and matching dimensions. Keep regular chat concise and personal. Address the user by the provided name when natural.'
    if request['purpose']=='braindump':
        instruction+=' Split the text into at most 12 useful tasks. Return only a JSON array of objects with title, sub and channel. Channel is a topic name without #. Respect explicit #mentions.'
    enabled=[s['title'] for s in request.get('skills',[]) if s.get('enabled')]
    if enabled:
        instruction+=' Preferred learned workflows: '+', '.join(enabled)
    result=agent.run_conversation(request['text'],system_message=instruction,conversation_history=request.get('history',[]))
    text=result.get('final_response')
    if not isinstance(text,str) or not text.strip():
        raise RuntimeError('Hermes returned no final response')
print(json.dumps(dict(text=text),ensure_ascii=False))
