from pathlib import Path
p = Path('/home/ubuntu/visual-climate/client/src/pages/Compare.tsx')
s = p.read_text()
old = 'stroke="#15171a" /></Bar></BarChart>'
new = 'stroke="#15171a" />} </Bar></BarChart>'
if old not in s:
    raise SystemExit('target not found')
p.write_text(s.replace(old, new, 1))
