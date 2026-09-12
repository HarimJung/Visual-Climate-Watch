# Visual Climate — 이 저장소가 무엇인가

**한 문장.** 218개국이 파리협정 아래 **실제로 제출한 것**의 공개 기록이다.
모든 숫자는 그 숫자가 나온 문서로 되짚어지고, 모든 빈칸은 비어 있는 **이유와
함께** 공개된다.

**파트너·UN용 영문 한 문장.** For every Party: the figures we read from its own
filings, the document and hash behind each, and a stated reason for every figure
we could not read.

**왜 그게 팔리는가.** 다른 대시보드는 빈칸을 추정으로 메운다. 정부는 추정에
반박할 수 없다. 자기 문서에는 반박할 수 있다. 그래서 이 기록은 문서만 찍는다.

## 트렁크

**이 저장소가 트렁크다** (2026-09-12 선언). 근거: 라이브·CI·주간 자동 갱신·도메인
라우팅·테스트 119건·218개국 레코드. 디스크에 같은 이름의 폴더가 셋 더 있다
(`Documents/visualclimate`, `Visual Climate Manus/visual-climate-saas`,
`Downloads/visual-climate-cop31`). **여기서는 그 셋에 커밋하지 않는다.**

## 제품이 사는 곳

```
pdf-45-50p-1-owid-climate/outputs/paris-movement/   ← 앱·엔진 전부. 모든 명령은 여기서.
```

```bash
npm test              # 전부 통과가 기준 (2026-09-12: 122건)
npm run dev           # 로컬
npm run engine:census # data/census.json 재생산 = 문서의 모든 수치의 출처
npm run engine:verify # 218개국 골든 바이트 비교
```

## 읽을 문서는 셋

| 문서 | 무엇 |
|---|---|
| `docs/PRD.md` | 제품. 수치는 전부 census 링크이고 `tests/prd-census.test.ts`가 대조한다. |
| `docs/ENGINEERING.md` | 엔진 규칙 R1~R10, 마일스톤, 함정 목록. 지시서 v4. |
| `docs/VERIFICATION.md` | 아직 닫지 못한 것. 사용자 검증 0명이 여기 적혀 있다. |

`ENGINE-BUILD.md`(v3)는 엔진 주석이 §9·M3으로 인용하므로 남겨 둔다. 그 밖의
세션 문서·핸드오프·낡은 상태 보고는 `docs/archive/`에 있다.
`docs/2026-09-12-red-team.md`가 지금 형태의 근거다.

## 불변 조건 (깨면 제품이 없다)

- `unknown ≠ absent`. 안 읽은 것을 "미제출"로 찍으면 실존 정부에 대한 허위 지적이다.
- 근거 없는 값을 만들지 않는다. 보간·등급·순위는 **비목표**(PRD §8)다.
- 애매하면 거절하고 사유 문장을 쓴다(R4·R10). 거절은 실패가 아니라 출력물이다.
- 화면의 숫자와 `data/census.json`은 같은 숫자다. 두 번 세지 않는다.
- 3D는 규칙 하나를 지킨다: **읽지 못한 부품은 그려지지 않는다.** 링은 0으로 무너지고,
  안 읽은 소켓은 빈 구멍이고, 추세를 못 재면 기어가 서 있는다.

## 요청하는 법 (이 틀로 쓰면 한 번에 끝난다)

```
목적  이 작업이 끝나면 [누가] [무엇을] 할 수 있다   ← 결과, 기능 이름 아님
범위  손대는 파일 / 안 대는 것
인수  report --json의 [키]가 [값]→[값] / 브라우저 [경로]에서 [무엇]이 보인다
금지  R[번호]
보고  ENGINEERING §8 형식, 멈춤
```
