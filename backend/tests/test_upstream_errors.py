import httpx
import pytest
from app.errors import upstream_http_error

@pytest.mark.parametrize('status,code',[(429,'rate_limit_exceeded'),(402,'insufficient_quota'),(401,'invalid_api_key')])
def test_actual_hermes_codes_and_retry_survive_without_credentials(status,code):
 request=httpx.Request('POST','http://hermes/v1/runs')
 response=httpx.Response(status,request=request,headers={'Retry-After':'30'},json={'error':{'code':code,'message':'Limit reached. Bearer private-token api_key=secret-value sk-abcdefghijk'}})
 error=upstream_http_error(httpx.HTTPStatusError('failed',request=request,response=response))
 assert error.status_code==status
 assert error.detail['code']==code
 assert error.headers['Retry-After']=='30'
 assert 'private-token' not in error.detail['message'] and 'secret-value' not in error.detail['message'] and 'sk-abcdefghijk' not in error.detail['message']

def test_non_json_upstream_body_is_not_leaked():
 request=httpx.Request('GET','http://hermes/api/jobs')
 response=httpx.Response(502,request=request,text='<html>private debug trace</html>')
 error=upstream_http_error(httpx.HTTPStatusError('bad',request=request,response=response))
 assert error.detail['code']=='hermes_http_502'
 assert 'debug' not in error.detail['message']
