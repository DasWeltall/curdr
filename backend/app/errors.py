"""Preserve actionable upstream diagnostics without forwarding credentials or response dumps."""
import re
from fastapi import HTTPException


def public_text(value, limit=600):
    text=str(value or '')
    text=re.sub(r'(?i)(bearer\s+)[a-z0-9._~+/=-]+', r'\1[redacted]', text)
    text=re.sub(r'(?i)((?:api[_-]?key|access[_-]?token|password|secret)\s*[=:]\s*)[^\s,;]+', r'\1[redacted]', text)
    text=re.sub(r'\bsk-[A-Za-z0-9_-]{8,}', '[redacted]', text)
    return text[:limit]


def upstream_http_error(error):
    response=error.response
    try: payload=response.json()
    except ValueError: payload={}
    source=payload.get('error', payload.get('detail', payload)) if isinstance(payload,dict) else {}
    if isinstance(source,str): source={'message':source}
    if not isinstance(source,dict): source={}
    code=source.get('code') or source.get('type') or 'hermes_http_'+str(response.status_code)
    message=source.get('message') or 'Hermes rejected this request.'
    retry=response.headers.get('retry-after','')
    headers={'Retry-After':retry} if retry.isdigit() else None
    status=response.status_code if 400<=response.status_code<600 else 502
    return HTTPException(status, {'code':public_text(code,100),'message':public_text(message),'source':'hermes','status':response.status_code}, headers=headers)
