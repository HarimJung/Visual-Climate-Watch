# 어셈블리 레드팀 · 2026-09-13 — 오늘 만든 Veyra 대 우리 무브먼트

비교 대상. `~/Documents/Codex/2026-09-13/9-17-26-x20/veyra-interactive-car`(오늘 세션이
v1.0.0 위에 얹은 assembly 모드) 대 이 저장소의 `components/movement/scene.tsx`
(+ `explosion-motion.ts`, `app/page.tsx`의 스테이지).

확인 방법. 두 코드베이스 전체를 읽음 · Veyra는 그 세션이 찍은 스크린샷 7장
(`.playwright-mcp/`) · 우리 쪽은 헤드리스 크롬(SwiftShader WebGL)으로 데스크톱
1440×900 스토리 6지점 + 폰 390×844 3시점을 직접 촬영 · 드로우콜은
`WebGL2RenderingContext.prototype.drawElements/drawArrays`를 패치해 셈 ·
`npm test` 122/122. 아래 수치는 전부 그 출력에서 나온다. 촬영본은
`~/Documents/Codex/2026-09-13/vc-assembly-red-team-shots/`(커밋 안 함).

---

## 0. 결론 네 줄

1. **Veyra의 어셈블리는 모델이 없어서 상자 13개를 그린다.** 본인 문서가 "Status:
   waiting for the part model", 화면이 "This is not the vehicle"이라 쓴다. 우리 것은
   국가 레코드의 필드가 부품이 되는 실제 기하다. 물건은 우리 쪽이고, 그건 안 바꾼다.
2. **그런데 Veyra가 342줄로 맞춘 규칙 셋을 우리는 못 맞췄다.** 카메라가 길을 잃지
   않는다(±40°/±11° + Reset view) · 바뀐 프레임만 그린다 · 물건 하나에 컨트롤 9개.
   우리는 궤도 무제한·리셋 없음, 스테이지가 화면 밖 524px에 있어도 **프레임당 719
   드로우콜**, 컨트롤 12개.
3. **디자이너가 첫눈에 보는 결함 셋은 CSS 두 줄과 조건 하나다.** 고정 스크롤 내내
   제목이 탑바 아래로 잘림(h1 top 54px < 탑바 64px), "Drag to turn" 알약이 범례를
   덮음, 챕터 04에서 라벨 9장이 기계를 덮음.
4. **가져올 건 규칙 셋이지 코드가 아니다.** 상자·와이어프레임·Explode/Assemble
   2버튼·크로스페이드·Google Fonts는 안 가져온다.

---

## 1. 오늘 만든 것이 무엇인가 — 사실

- 원본 `amirmushichge/veyra-interactive-car` v1.0.0(`5779ec0`): 렌더 정지화상 +
  호버 mp4 4개, 페인트 5·휠 3. **WebGL 없음.** "This release is an interaction scene,
  not a scroll-scrubbed landing page."
- 오늘 세션이 얹은 것(전부 untracked): `src/assembly.ts` 61줄(타임라인 순수 수학),
  `AssemblyScene.tsx` 163줄(three 0.186, GLTFLoader, 프록시 상자), `AssemblyView.tsx`
  76줄(컨트롤), `production/test-assembly.cjs` 42줄, `docs/ASSEMBLY.md`. `App.tsx`
  +49, `index.css` +33, `package.json`에 three 추가. **합계 342줄.**
- glTF가 없으니 상자 9종 + 실린더 4개. 5단계(chassis+battery → motor+driveline →
  suspension+wheels → interior+glass → body+hood), 10초, 단계별 균등 창, ease 하나.
- 그 세션의 검증(`outputs/VEYRA-실행결과.md`): 6개 뷰포트 가로 넘침 없음, 콘솔
  오류 없음, 원본의 Escape 초점 버그 재현. 정직하게 쓴 문서다.

---

## 2. 나란히

| | Veyra assembly (오늘) | 우리 무브먼트 |
|---|---|---|
| 부품 | 프록시 상자 13 · 데이터 없음 | 레코드 필드 = 부품. 링 = NDC %, 기어 = 관측 연수·추세 부호, 소켓 8 = BTR 상태, 브리지 = 8/8 unknown이면 미착좌, 금 기어 = 수령 unknown이면 반투명 |
| 타임라인 | 5단계 균등 창, `partProgress` 함수 하나, 42줄 테스트 | 9장(열기→5층→펼침→귀환→닫힘), `explosion-motion.ts` 56줄, 테스트 6건 |
| 구동 | 버튼·슬라이더·단계 이동, 항상 보임 | 데스크톱 스크롤 스크럽(680svh), 폰 30초 내레이션, 슬라이더는 `<details>` 안 |
| 카메라 | yaw ±40° pitch ±11° 클램프 · Reset view · 매 프레임 바운드 재프레임 | OrbitControls 무제한(극각 0–π, 방위 무제한) · 리셋 없음 · 자동 fit은 첫 드래그까지만 |
| 렌더 | dirty일 때만 `render` | 기어가 돌면 매 프레임 dirty → 항상 렌더. **화면 밖에서도** |
| 드로우콜/프레임 | ~30 (13그룹 × 메시+엣지) | **760** (그림자 패스 포함, 969×510 측정) |
| 조명 | 반구광 + 방향광, 그림자 없음 | RoomEnvironment PMREM + 2048² PCFSoft 그림자 + ACES |
| 라벨 | 없음(알림 1개) | 부품 라벨 5 + BTR 태그 8 + 리더선, 충돌 회피 |
| 정직 표시 | "Proxy geometry… This is not the vehicle." | "A document-data assembly, not a live ETL feed" · "never stands for progress" · 범례 2줄 |
| 스테이지 위 크롬 | 알림 1 | **9** (헤딩·번호·챕터 팝업·범례·하단 2줄·힌트 알약·화살표 2) |
| 컨트롤 수 | 9 | 12 (데스크톱; D7 참조) |
| 키보드 | 화살표 = 궤도 | 화살표 = 다음 나라. 궤도 키 없음 |
| 감속 모션 | Play 숨김, 끝 상태로 점프 | `amount=target` 즉시, 기어 정지. 동급 |
| 폰 | 프레임 안 차가 ~150px | 스테이지 421px, 물건이 채움. 우리가 낫다 |
| 폴백 | "WebGL is not available" 문장 | `StaticDial` SVG + 문장. 우리가 낫다 |
| 내보내기 | 없음 | PNG 프레임, 10초 webm |
| 번들 | three 전체 | three 청크 695KB, 동적 import |

---

## 3. 디자이너 눈 — 우리 쪽 결함, 증거 순

- **D1. 고정 스크롤 중 제목이 잘린다.** `.scroll-pin{top:0;height:100svh}`인데
  탑바가 `--top-h:64px` 스티키. 측정: h1 top 54px, 탑바 bottom 64px. 스토리 6장
  중 5장에서 "What we protect is"의 윗부분이 없다. `app/globals.css:132`, `:674`.
  (`s-p25.jpg` 이후 전부)
- **D2. 힌트 알약이 범례를 덮는다.** `.stage-hint{bottom:50px}` 위에
  `.stage-key{bottom:42px}`. "Empty bore = nothing read for that seat"가 첫 클릭
  전까지 안 읽힌다 — 이 줄이 09-12 §5-5 규칙을 화면에서 설명하는 유일한 문장이다.
  검은 알약은 상아색 종이에서 유일한 검정 면이기도 하다. (모든 데스크톱 컷)
- **D3. 챕터 04에서 라벨이 기계를 가린다.** 부품 라벨 5 + BTR 태그 4가 겹쳐
  기어열과 플레이트가 안 보인다. 충돌 회피는 라벨끼리만 피하고 물건은 안 피한다.
  가장 손해 보는 프레임. (`s-p50.jpg`)
- **D4. 같은 문장이 세 번.** 챕터 팝업(좌상 282px) · 내레이션 스트립(아래) ·
  아나토미 키 하이라이트(좌측). Veyra는 "Stage 03 of 05 · Suspension and wheels"
  한 번.
- **D5. 바닥 그림자가 두 번째 그림이다.** 펼친 부품의 그림자가 기계보다 크게
  오른쪽에 깔린다. 챕터 02에서 금 기어+링의 그림자는 수갑 모양으로 읽힌다.
  opacity .14, radius 4. (`s-p25.jpg` 우측)
- **D6. 물건이 작다.** 1440×900에서 스테이지 969×510, 기계는 폭의 약 30%. 챕터
  00에서 뚜껑이 7.4 단위 위로 떠서 fit이 뚜껑까지 잡는다. Veyra는 바운드×1.08로
  프레임을 채운다.
- **D7. 컨트롤 12개(데스크톱).** Explode layers · Replay · Pause · Top-down ·
  Sources · Save frame · 10-second film · Play once · 스크럽 · 줌 · ← →. aside의
  "Replay the assembly"는 폰에서만 보이므로 데스크톱 중복은 아니다(초판의 "14개,
  Replay 둘"은 폰 기준 — 정정). 물건 하나에 12개는 전문가용이 아니라 데모용이다.
- **D8. 챕터 이동이 없다.** 협상관은 "BTR 챕터로 바로"가 필요한데 스크롤하거나
  `<details>`를 열어 슬라이더를 밀어야 한다. 아나토미 키 01–05는 시트를 열지
  스토리를 옮기지 않는다. phase-track의 대시 8개는 클릭이 안 된다.
- **D9. 폰 390.** "Replay the assembly ⟲" 아이콘이 "Read the full record"에 붙는다
  (`s-m4.jpg`). 뚜껑이 프레임 위로 잘린다(`s-m16.jpg`) — 설계상 허용("decorative
  poles may extend beyond the study's edge")이지만 폰에선 크롭으로 읽힌다.

**잘 된 것 — 바꾸지 않는다.** 챕터 06 펼침(`s-p78.jpg`)은 두 반구·링·기어가
도면처럼 놓여 제품에서 가장 아름다운 프레임이다. 07 귀환 프레임의 크기와 조명.
폰 스테이지 비율. 라벨 색과 부품 소재의 일치, 리더선. 소켓 구멍·미착좌 브리지·정지
기어 — 09-12 §5-5의 규칙이 캄보디아에서 실제로 켜져 있다(8 unparsed 소켓 전부
구멍). 이건 Veyra에 없고, 어느 경쟁 대시보드에도 없다.

---

## 4. 개발자 눈 — 측정

- **E1. 화면 밖 렌더.** 스테이지 상단이 뷰포트 위 524px일 때 3초에 7,188
  드로우콜(10프레임). 그림자 맵 2048² + 환경맵 + 풀 렌더가 독자가 푸터를 읽는 동안
  계속 돈다. `document.hidden`만 본다. IntersectionObserver 하나면 0이 된다.
- **E2. 매 프레임 dirty.** `if(animate){gearTime+=dt;dirty=true}` — 기어가 도는
  한 온디맨드 렌더가 무력하다. 일시정지하면 0 드로우콜(180프레임에 0 측정) →
  온디맨드 경로는 이미 있고 기어 회전만이 강제한다. 기어는 화면에 보일 때만 돌면
  된다(E1과 같은 옵저버).
- **E3. 760 드로우콜/프레임.** 나사 12개(72분할 실린더+박스), 관측 마커 49개
  (72분할 실린더), 링 세그먼트 50, 소켓 8×4, 칩 5×6…. 정적 메시를 재질별로
  `mergeGeometries`하면 ~40. 큰 수술이니 지금은 아니다 — E1·E2가 먼저다.
- **E4. 궤도 무제한.** `minPolarAngle`/`maxPolarAngle`/`min|maxAzimuthAngle` 없음.
  바닥 아래로 내려가면 그림자 평면 뒷면과 잘린 반구가 보이고, `manualCamera=true`가
  되면 다음 입력까지 자동 fit이 꺼진다. 리셋 버튼 없음(Top-down 토글만).
- **E5. 나라 바꾸면 씬 전체 재건축.** `useEffect(…,[data])` → dispose → three
  재import → PMREM 재생성 → `earth.jpg` 재로드. ← → 로 218개국 넘길 때마다.
  브라우저 캐시가 받쳐 주지만 구조는 "업데이트"가 아니라 "재건축"이다.
- **E6. `preserveDrawingBuffer:true` 상시.** 내보내기 때문인데, 내보내기 직전에
  `renderer.render` 한 번이면 된다. 모바일 GPU에서 비용.
- **E7. DPR 데스크톱 2.** 969×510×4 픽셀 × 그림자. 1.5 캡이면 −44%.
- **E8.** 캔버스 텍스처 21장(engraving)이 `Helvetica` 하드코딩, 페이지는 Geist. 미세.

Veyra 쪽도 완벽하지 않다: 슬라이더 변화마다 8코너 재프레임(폰에서 무겁다고 본인
문서가 인정), 프록시라 재질 없음, Escape 초점 버그 재현, Google Fonts 의존.
그리고 **데이터가 하나도 없다.**

---

## 5. Veyra에서 가져올 것 / 안 가져올 것

**가져온다 — 규칙 셋.**
1. 카메라는 길을 잃지 않는다 — 클램프 + Reset view.
2. 바뀐 것만 그린다 — 화면 밖·정지 시 0.
3. 물건 하나에 컨트롤은 한 줄 — 단계 이동은 있고 중복은 없다.

**안 가져온다.** 상자/와이어프레임 미학(우리는 진짜 기하가 있다) ·
Explode/Assemble 2버튼(우리 스토리는 9장 스크롤) · 크로스페이드-정지화상 모델
(미디어 기반) · Google Fonts · 3px 흰 프레임 · glTF 로더.

---

## 6. 요청 — 순서대로, CLAUDE.md 틀

```
1.
목적  독자가 고정 스크롤 내내 제목을 읽고, 범례를 읽는다
범위  app/globals.css만
인수  .scroll-pin의 top/height가 --top-h를 뺀다 (h1 top ≥ 64px)
      .stage-hint와 .stage-key가 겹치지 않는다 (힌트 bottom ≥ 범례 top + 8)
      데스크톱에서 챕터 팝업과 내레이션 스트립 중 하나만 남는다
금지  scene.tsx
보고  ENGINEERING §8 + s-p25 재촬영, 멈춤
```

```
2.
목적  독자가 어떻게 드래그해도 기계를 잃지 않고, 스테이지를 지나치면 GPU가 쉰다
범위  components/movement/scene.tsx만
인수  OrbitControls 극각 [0.35, 1.45] rad · 방위 현재 study angle ± 0.8 rad
      manualCamera일 때만 rail에 "Reset view" → fitDirty=true, manualCamera=false
      IntersectionObserver: 스테이지가 안 보이면 frame()이 render와 gearTime을 건너뛴다
        (측정: 화면 밖 3초 드로우콜 0)
      DPR 캡 1.5 · preserveDrawingBuffer:false + 내보내기 직전 render 1회
      npm test 122 통과, 218개국 렌더 무변화
금지  모션 타이밍·레이아웃 함수·부품 기하 (R6)
보고  §8 + 드로우콜 before/after, 멈춤
```

```
3.
목적  챕터 04에서 기계가 보인다
범위  scene.tsx의 updateLabels만
인수  btrStepAt(story) >= 0 일 때 부품 라벨은 04(BTR) 하나만 보인다
      다른 챕터는 현행 유지 · s-p50 재촬영에서 기어열과 플레이트가 보인다
금지  라벨 문구 변경
보고  §8, 멈춤
```

```
4.
목적  독자가 챕터 04로 한 번에 간다
범위  app/page.tsx, app/globals.css
인수  phase-track 대시 8개가 버튼(aria-label "챕터 n으로")이고 누르면 그 챕터
        시작으로 seek (setProgress + setMotionInput)
      aside "Replay the assembly"와 rail "Replay"가 하나가 된다
      스토리 슬라이더가 <details> 밖 rail 한 줄에 항상 보인다
      (컨트롤 수는 세지 않는다 — D7 정정 참조)
금지  엔진·데이터·scene.tsx
보고  §8 + 스크린샷, 멈춤
```

**선택** — 움직이는 부품 하이라이트(Veyra의 acid 엣지에 해당). 우리는 라벨
`is-active`가 이미 있으니, 그 부품 칩의 emissive를 0→.15로 펄스. 1시간. 요청 1–4
뒤에.

**E3 기하 병합** — 요청 2 뒤에 드로우콜을 다시 재고 결정한다.

---

## 7. 지금 하지 않는 것

glTF 모델·프록시 도입 · three 버전(r180→r186) · 기하 병합(E3) · 크로스페이드 ·
Veyra 코드 복사 · 폰 첫 화면 재배치(09-12 §5-4의 결정 위에 있다) · `data/` 아무것도.

---

## 8. 확인 방법

- **3D 헤드리스 촬영이 된다.** VERIFICATION §1의 "3D 씬은 헤드리스 촬영에서 신뢰할
  수 없다"는 닫힌다: 크롬 `--headless=new --use-angle=swiftshader
  --enable-unsafe-swiftshader --remote-debugging-port=9333` + CDP
  `Emulation.setDeviceMetricsOverride`. 단, SwiftShader는 ~3fps이고 `frame()`의
  `dt`가 .05로 캡돼 감쇠가 시간이 아니라 프레임 기준이라 **스크롤 후 9초** 기다려야
  정착한다. 6초 컷은 전환 중간이다.
- **드로우콜.** `WebGL2RenderingContext.prototype.drawElements/drawArrays` 패치,
  3초 표본. 실행 중 760/프레임 · 일시정지 0 · 화면 밖 719.
- **`npm test`** 122/122, 변경 없음. 이 문서는 코드를 바꾸지 않았다.

---

## 9. 실행 · 2026-09-13 — 브랜치 `assembly-red-team-fixes`

요청 1·2·3과 4의 챕터 버튼을 같은 날 실행했다. 변경 파일 5. 슬라이더를 `<details>`
밖으로 꺼내는 것은 하지 않았다: 챕터 버튼이 점프를 맡으니 세밀 스크럽은 접힌 채로
충분하다.

| 항목 | 전 | 후 | 확인 |
|---|---:|---:|---|
| 고정 스크롤 중 h1 top (탑바 bottom 64px) | 54px | **118px** | CDP 측정, `after-v-p25.jpg` |
| 힌트 알약 bottom / 범례 top | 겹침 | **426 / 450** | 〃 |
| 같은 챕터 문장 | 팝업 + 스트립 | 스트립 하나 | `.chapter-popup` 삭제(JSX·CSS) |
| 챕터 04 중 보이는 부품 라벨 | 5 | **1** (04만) + BTR 태그 | `after-v-p50.jpg` |
| 화면 밖 3초 드로우콜 | 7,188 | **0** (180프레임) | IntersectionObserver |
| 드래그 뒤 복귀 | 없음 | **Reset view** 버튼(드래그 때만) | `after-v-dragged.jpg` → `after-v-reset.jpg` |
| 바닥 아래 궤도 | 가능 | `maxPolarAngle=1.5` | 프로그램 뷰는 전부 ≤1.12 rad라 전환을 건드리지 않는다 |
| DPR 상한 | 데스크톱 2 | 1.5 | |
| `preserveDrawingBuffer` | 상시 | 없음 · 내보내기 직전 render 1회 | Save frame 영역 어두운 픽셀 86,818 (빈 프레임이면 0) |
| 챕터 점프 | 없음 | phase-track 대시 8개 = 버튼, 데스크톱은 스크롤로 seek | `chapterStart()` + 테스트 1건 |
| 힌트가 사라지는 조건 | 첫 클릭 | 첫 클릭 **또는 첫 스크롤** | 휠 사용자가 영원히 보던 문제 |
| `npm test` | 122 | **123** | |

**트레이드오프 하나.** 핀이 탑바 아래로 내려오면서(`top:var(--top-h)`) 1440×900에서
스테이지가 510→446px가 됐다. 전에는 스테이지 윗부분 64px가 탑바 뒤에 숨어 있었으니
보이는 면적은 같고, 이제 "LAYER BY LAYER" 헤딩이 실제로 보인다. 기계는 약 6% 작게
잡힌다. 더 크게 보이려면 D6(fit 여백)이 다음 손잡이다.

**남은 것.** D5 바닥 그림자 · D6 물건 크기 · E3 기하 병합(보일 때 760 드로우콜/프레임은
그대로) · E5 나라 전환 재건축 · 선택 항목(움직이는 부품 하이라이트).
