from pathlib import Path
p=Path('/home/ubuntu/visual-climate/client/src/pages/Compare.tsx')
s=p.read_text()
old='{metric === "absolute" && <ErrorBar dataKey="error" width={5} strokeWidth={1.5} stroke="#15171a" />} </Bar>'
new='</Bar>'
if old not in s:
    raise SystemExit('target not found')
p.write_text(s.replace(old,new,1))
