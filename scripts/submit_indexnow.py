"""Notify IndexNow about canonical public URLs after a successful deployment.
The ownership key is deliberately hosted publicly, as required by IndexNow.
This does not use a Google or Bing account credential and does not guarantee indexing.
"""
from pathlib import Path
import json
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
BASE='https://varnaresh17.github.io/'

def main():
    key=(ROOT/'indexnow-key.txt').read_text().strip()
    location=BASE+'indexnow-key.txt'
    try:
        with urllib.request.urlopen(location,timeout=30) as response:
            if response.read().decode().strip()!=key:
                raise ValueError('The published IndexNow verification file does not match this checkout.')
        urls=[e.text for e in ET.parse(ROOT/'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        if not urls or any(not u.startswith(BASE) for u in urls):
            raise ValueError('Unexpected sitemap URL')
        body={'host':'varnaresh17.github.io','key':key,'keyLocation':location,'urlList':urls}
        request=urllib.request.Request('https://api.indexnow.org/indexnow',data=json.dumps(body).encode(),headers={'Content-Type':'application/json; charset=utf-8'},method='POST')
        with urllib.request.urlopen(request,timeout=45) as response:
            print(f'IndexNow HTTP {response.status}: submitted {len(urls)} URLs. Receipt is not an indexing or ranking guarantee.')
    except (urllib.error.URLError, ValueError) as error:
        print('IndexNow submission not completed:',str(error))
        return 1
    return 0

if __name__=='__main__':
    raise SystemExit(main())
