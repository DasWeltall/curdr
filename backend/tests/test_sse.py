import asyncio
from app.sse import events

def test_sse_comments_multiline_unicode_and_ids():
    async def run():
        async def lines():
            for line in [': keepalive','','event: tool.started','id: 4','data: {"tool":','data: "web_search", "preview":"Münster"}','','data: [DONE]','']:
                yield line
        values=[event async for event in events(lines())]
        assert values[0]=={'tool':'web_search','preview':'Münster','event':'tool.started','_id':'4'}
        assert values[1]['event']=='done'
    asyncio.run(run())
