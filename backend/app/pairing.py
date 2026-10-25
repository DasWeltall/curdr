"""Short-lived, single-use pairing; the permanent gateway token never enters a QR URL."""
import hashlib
import secrets
import time
from fastapi import HTTPException


def issue_pair(db,ttl=600):
    code=secrets.token_urlsafe(24)
    with db.lock:
        db.put('pair','pending',{'hash':hashlib.sha256(code.encode()).hexdigest(),'expires':time.time()+ttl,'used':False})
    return {'code':code,'expires_in':ttl}


def exchange_pair(db,code):
    if not isinstance(code,str) or not 16<=len(code)<=128:
        raise HTTPException(401,'Invalid pairing code.')
    with db.lock:
        pending=db.get('pair','pending')
        if not pending or pending['used'] or pending['expires']<=time.time() or not secrets.compare_digest(pending['hash'],hashlib.sha256(code.encode()).hexdigest()):
            raise HTTPException(401,'Pairing code is invalid, expired or already used.')
        db.put('pair','pending',{**pending,'used':True})
