import json, tempfile, threading, unittest, urllib.request, urllib.error
from server import app
class TestHTTP(unittest.TestCase):
    def test_direct_access_workflow(self):
        with tempfile.TemporaryDirectory() as tmp:
            app.DB=tmp+'/http.db'; app.init()
            server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            def request(path,data=None):
                req=urllib.request.Request(f'http://127.0.0.1:{server.server_port}/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','X-CCQ-Request':'1'})
                with urllib.request.urlopen(req) as response:return json.load(response)
            try:
                state=request('state');self.assertEqual(len(state['rolls']),5)
                data={'roll_id':0,'version':0,'occurred':app.now(),'serial':'R-001','reason':'Cadastro inicial','operator':'Abner'}
                request('replacements',data)
                state=request('state');self.assertEqual(state['rolls'][0]['status'],'green');self.assertEqual(state['events'][0]['operator'],'Abner')
                with self.assertRaises(urllib.error.HTTPError) as e:request('tasks',{'roll_id':0,'title':'Verificar vibração'})
                self.assertEqual(e.exception.code,400)
                with self.assertRaises(urllib.error.HTTPError) as e:request('login',{'operator':'Abner'})
                self.assertEqual(e.exception.code,400)
            finally:server.shutdown();server.server_close();thread.join()
