"""Bounded native visualization protocol. No generated HTML or JavaScript executes."""
import json
import re
from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator

class Strict(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
class Metric(Strict):
    label:str=Field(max_length=60)
    value:Annotated[str,Field(max_length=160)]|float
class Metrics(Strict):
    type:Literal['metrics']
    items:list[Metric]=Field(min_length=1,max_length=6)
class Series(Strict):
    name:str=Field(max_length=60)
    values:list[float]=Field(min_length=1,max_length=24)
class Chart(Strict):
    type:Literal['chart']
    kind:Literal['bar','line']='bar'
    title:str=Field(default='',max_length=100)
    labels:list[str]=Field(min_length=1,max_length=24)
    series:list[Series]=Field(min_length=1,max_length=4)
    @model_validator(mode='after')
    def dimensions(self):
        if any(abs(value)>1e12 for series in self.series for value in series.values):raise ValueError('Chart value out of range.')
        if any(len(s.values)!=len(self.labels) for s in self.series) or any(len(s)>60 for s in self.labels):raise ValueError('Chart dimensions do not match.')
        return self
class Table(Strict):
    type:Literal['table']
    columns:list[str]=Field(min_length=1,max_length=6)
    rows:list[list[str|float]]=Field(max_length=30)
    @model_validator(mode='after')
    def dimensions(self):
        if any(len(column)>100 for column in self.columns) or any(isinstance(value,str) and len(value)>1500 for row in self.rows for value in row):raise ValueError('Table text is too long.')
        if any(len(row)!=len(self.columns) for row in self.rows):raise ValueError('Table dimensions do not match.')
        return self
class Check(Strict):
    text:str=Field(min_length=1,max_length=160)
    done:bool=False
class Checklist(Strict):
    type:Literal['checklist']
    items:list[Check]=Field(min_length=1,max_length=20)
class Calculator(Strict):
    type:Literal['calculator']
    label:str=Field(max_length=80)
    min:float
    max:float
    value:float
    step:float=Field(default=1,gt=0)
    multiplier:float=1
    offset:float=0
    resultLabel:str=Field(max_length=80)
    unit:str=Field(default='',max_length=15)
    @model_validator(mode='after')
    def bounds(self):
        if any(abs(value)>1e12 for value in (self.min,self.max,self.value,self.offset)):raise ValueError('Calculator value out of range.')
        if not self.min<self.max or not self.min<=self.value<=self.max or self.max-self.min>1e12 or abs(self.multiplier)>1e9:raise ValueError('Invalid calculator range.')
        return self
class Note(Strict):
    type:Literal['text']
    text:str=Field(max_length=1500)
Block=Annotated[Union[Metrics,Chart,Table,Checklist,Calculator,Note],Field(discriminator='type')]
class Visual(Strict):
    title:str=Field(min_length=1,max_length=80)
    description:str=Field(default='',max_length=240)
    blocks:list[Block]=Field(min_length=1,max_length=8)

def extract_visual(response):
    match=re.search(r'```curdr\s*\n([\s\S]*?)```',response)
    if not match or len(match[1])>65536:return response,None
    try: visual=Visual.model_validate_json(match[1])
    except ValueError:return response,None
    text=(response[:match.start()]+response[match.end():]).strip()
    return text,visual.model_dump()

def store_response(db,response,channel,message_id=None):
    from .db import now,uid
    text,visual=extract_visual(response)
    from .founder import chunks
    def emit_text(value,identity=None):
        for index,part in enumerate(chunks(value)):
            db.event('message',dict(id=identity if index==0 and identity else uid(),role='agent',kind='text',text=part,channel=channel,createdAt=now(),streaming=False))
    if visual:
        item=dict(id=uid(),name=visual['title']+'.curdr.json',channel=channel,mime='application/vnd.curdr.visual+json',content=json.dumps(visual,ensure_ascii=False),updatedAt=now())
        if text:emit_text(text,message_id)
        db.event('file_added',item)
        db.event('message',dict(id=uid() if text else message_id or uid(),role='agent',kind='artifact',fileId=item['id'],title=visual['title'],description=visual['description'],channel=channel,createdAt=now()))
        return text or visual['description'] or visual['title'],item
    emit_text(response,message_id)
    return response,None
