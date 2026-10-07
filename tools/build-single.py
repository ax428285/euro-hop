"""
把整個遊戲打包成單一個 HTML 檔（dist/euro-hop.html）。

用途：傳給朋友、上傳到免費靜態空間（Netlify Drop、itch.io⋯⋯）。
遊戲沒有外部資源（圖都是程式畫的、音效是 WebAudio 合成），
所以只要把 css 與所有 js 內嵌進 index.html 就能單獨開。

用法：python tools/build-single.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    html = read('index.html')

    def inline_css(m):
        return '<style>\n' + read(m.group(1)) + '\n</style>'

    def inline_js(m):
        src = read(m.group(1))
        # 內嵌後 JS 裡若出現 </script 會提早結束標籤，先擋掉
        src = src.replace('</script', '<\\/script')
        return '<script>\n' + src + '\n</script>'

    html, n_css = re.subn(r'<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?"\s*/?>', inline_css, html)
    html, n_js = re.subn(r'<script src="([^"?]+)(?:\?[^"]*)?"></script>', inline_js, html)

    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    # index.html：網址根目錄直接就是遊戲（https://xxx.netlify.app/）
    # euro-hop.html：舊連結（.../euro-hop.html）已經傳出去了，保留同一份避免失效
    for name in ('index.html', 'euro-hop.html'):
        out = os.path.join(ROOT, 'dist', name)
        with open(out, 'w', encoding='utf-8') as f:
            f.write(html)
    print('inlined %d css, %d js -> dist/index.html + dist/euro-hop.html (%d KB)'
          % (n_css, n_js, os.path.getsize(out) // 1024))


if __name__ == '__main__':
    main()
