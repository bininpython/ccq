import json, os, tempfile, threading, unittest, urllib.request, urllib.error, http.cookiejar
from server import app
class TestHTTP(unittest.TestCase):
    def test_authenticated_workflow(self):
        with tempfile.TemporaryDirectory() as tmp:
            app.DB=tmp+'/http.db'; app.init();os.environ['CCQ_ACCESS_PASSWORD']='test-password-only'
            server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
            def request(path,data=None):
                req=urllib.request.Request(f'http://127.0.0.1:{server.server_port}/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','X-CCQ-Request':'1'})
                with client.open(req) as response:return json.load(response)
            try:
                with self.assertRaises(urllib.error.HTTPError) as e:request('state')
                self.assertEqual(e.exception.code,401)
                self.assertEqual(request('login',{'operator':'Abner','password':'test-password-only'})['operator'],'Abner')
                state=request('state');self.assertEqual(len(state['rolls']),5)
                request('replacements',{'roll_id':0,'version':0,'occurred':app.now(),'serial':'R-001','reason':'Cadastro inicial'})
                state=request('state');self.assertEqual(state['rolls'][0]['status'],'green');self.assertEqual(state['events'][0]['operator'],'Abner')
                request('logout',{})
                self.assertIsNone(request('session')['operator'])
            finally:server.shutdown();server.server_close();thread.join()
