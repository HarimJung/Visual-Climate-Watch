# 새 창에 붙여넣을 프롬프트

아래 블록을 그대로 복사해서 새 Claude Code 창(이 저장소 루트에서 시작)에 붙여넣는다.

---

```
pdf-45-50p-1-owid-climate/outputs/paris-movement/docs/PRD.md 와
pdf-45-50p-1-owid-climate/outputs/paris-movement/docs/ENGINEERING.md 를 먼저 다 읽어라.

그 다음 ENGINEERING.md §0의 네 줄을 실제로 돌려서 문서의 표가 현재 코드와
맞는지 직접 확인하고, 틀린 게 있으면 표를 고치고 보고한 뒤 시작한다.

확인이 끝나면 ENGINEERING.md §6의 M9를 진행한다. M9는 새 수집이 전혀 없고
이미 빌드된 데이터 위의 화면 작업이다:
  1. 거절 로그 화면 (derived.$reason 214건 + ndc_document.$reason 150건)
  2. 소스 불일치 화면 (emissions_profile.by_source, 198개국)
  3. 취약성 × 재원 교차 화면 (190 × 136, 다국가 미귀속을 1급 시민으로 표기)
  4. /api/v1/provenance/<ISO3>/<field> 엔드포인트

지킬 것:
- ENGINEERING.md §2의 R1~R10. 특히 R8(인용 없는 승격 금지), R9(WAF 우회 금지),
  R10(정밀도가 재현율을 이긴다).
- engine/__tests__/ndc-extract.test.ts 를 지우거나 완화하면서 파서를 "개선"하지 마라.
  그 13개 케이스는 전부 실제로 잘못 읽었던 문장이다.
- 화면에 쓰는 모든 수치는 `node engine/cli.ts report --json` 에서 나와야 한다.
  손으로 옮겨 적지 마라.
- 끝나면 ENGINEERING.md §8 형식으로 보고하고 멈춘다. 한 번에 M10까지 가지 마라.

포트 주의: npm start(wrangler, 8787+8788)와 npm run engine:serve(8787)를
동시에 띄우지 마라. 502가 나면 십중팔구 이것이다.
```

---

## 지금 상태 요약 (프롬프트와 함께 참고)

- 218개국 레코드 · 12/42 소스 연결 · 관측점 11,670
- NDC 원문 168건 확보 → 18건 수치 추출, 150건 사유 있는 거절
- BTR1 제출 134개국 · 8요소 소켓 328/1,744에 첨부 파일명 근거
- GCF 재원 136개국 ($21.36bn 승인 / $4.55bn 귀속 집행)
- 테스트 58/58 · 계약 게이트 218/218 · golden clean
- 커밋 안 됨 (working tree에 전부 있음)
