# 임윤찬 모차르트 리사이틀 예습 페이지

목표: 리사이틀 5곡(15개 악장)을 YouTube 음원으로 들으며, 지금 연주 중인 마디를 Verovio 악보 위에 실시간으로 표시하는 정적 웹앱. 설계는 `DESIGN.md`(로컬에만 있음, 커밋하지 않음).

배포: `main`에 push → GitHub Actions(`.github/workflows/deploy.yml`) → https://pass-song.github.io/yunchan-mozart-prep/ . 빌드 base는 `/yunchan-mozart-prep/`(vite.config.ts), data 경로는 `assetUrl()`로 붙인다.

## 명령

- `npm run dev` — 개발 서버
- `npm test` — 단위 테스트 (vitest, `tests/`)
- `npm run build` — 타입 검사 + 빌드
- `npx tsc` — 타입 검사만

## 폴더 구조

```
data/                 # Vite publicDir. pieces.json 안의 경로는 data/ 기준이며 그대로 fetch 된다
├─ pieces.json        # 곡·악장 메타데이터, 재생 순서(= 공연 순서)
├─ scores/            # craigsapp/mozart-piano-sonatas 원본 .krn (수정하지 않는다)
├─ timings/           # 타이밍 맵: {movementId}.son.json (손열음) / .lim.json (임윤찬). 경로는 pieces.json의 timing
└─ notes/             # 악장별 해설 마크다운
audio/                # 구매 음원 (커밋하지 않는다)
tools/                # 정렬·검증 스크립트
src/
├─ audio/             # AudioSource, YouTubeSource(+TimeInterpolator 보간), MovementPlayer(악장 구간 재생·자동 다음 악장)
├─ score/             # ScoreView(Verovio로 악장 전체를 화면 폭의 긴 한 장으로 렌더), measureIds(마디 ID), performOrder(반복 펼친 연주 순서)
├─ sync/              # (화면에서 뺌) SyncEngine, anchors(기준점 보간)
├─ ui/                # (화면에서 뺌) TapRecorder. 화면 연결은 main.ts
└─ main.ts
tests/                # 단위 테스트
```

## 마디 ID 규칙

마디 ID는 문자열이며 원본 Humdrum 파일의 마디 번호를 그대로 쓴다 (`src/score/measureIds.ts`).

- `"0"` = 못갖춘마디 (번호 없는 첫 마디)
- 1·2번 괄호(volta)는 원본처럼 각자 다른 번호를 가진다. 예: K.331 3악장 1번 괄호 = `"96"`, 2번 괄호 = `"97"`. a/b 접미사는 쓰지 않는다.
- 번호 없는 중간 마디(반복 기호에서 쪼개진 조각, 카덴차) = 직전 마디 ID + `.1`, `.2` … 예: `"8.1"`, `"173.2"`
- 화면 표기와 실물 악보 대조는 마디 번호 기준. 줄 나눔은 Verovio가 정한다.

## 타이밍 맵 스키마

연주된 순서대로의 마디 목록이다. 반복 때문에 같은 마디 ID가 여러 번 나와도 된다.

```json
{
  "movementId": "k331-3",
  "recordingId": "son-naive-2023",
  "audioOffset": 0.42,
  "events": [
    { "t": 0.42, "m": "0" },
    { "t": 1.10, "m": "1" }
  ]
}
```

- `t`: 영상 기준 초 (악장 `start`가 아니라 영상 처음부터). 단조 증가.
- `m`: 위 규칙의 마디 ID. 악보에 존재해야 한다.
- `anchor`: (선택) `true`면 기준점 모드에서 사용자가 직접 탭한 마디. 나머지는 보간값. 이 파일을 다시 열면 기준점을 이어서 고칠 수 있다.
- `audioOffset`: 트랙 시작의 무음 길이. 탭 모드는 첫 탭 시각 − 악장 `start`로 채운다.

## 화면

- `pieces.json`의 `audio.start`~`end`(초, 영상 기준)만 재생한다. 매 프레임 영상 시각이 같은 영상의 어느 악장 구간에 있는지로 현재 악장을 정하고(`MovementPlayer`), 맞는 악장이 없으면 다음 곡 영상으로. `end: null` = 영상 끝까지.
- 악보는 페이지로 나누지 않는다. 악장 전체를 화면 폭에 맞춘 긴 한 장(pageHeight 최대, 높이 자동)으로 그리고 사용자가 손으로 세로 스크롤한다. 악장이 바뀌면 맨 위로.
- 악보 크기(Verovio scale)는 상단 −/+ (15~80%, 5단위), localStorage `score-scale`에 저장. 기본값 폰(폭 600px 미만) 20%, PC 40%. 폰 폭 344px·20%에서 한 줄 3~5마디.
- 자동 넘김·마디 하이라이트·방향키 넘김은 없다(2026-10-11 결정). 타이밍 맵도 만들지 않는다.
- 탭 모드·타이밍 맵 싱크는 화면에서 뺐지만 모듈과 테스트는 남아 있다: `SyncEngine`, `TapRecorder`, `AnchorEditor`(기준점 보간), `performOrder`(Humdrum `*>[A,A,B,…]` 확장 목록 → 연주 순서), `measureDurations`(마디 길이). 되살리려면 main.ts에 다시 연결한다.
- 여러 파일로 나뉜 악장(K.331 1악장)은 Verovio가 한 번에 못 읽어서 파일마다 툴킷을 따로 두고 이어 붙인다.

## 규칙

- 음원 파일은 커밋하지 않는다 (`audio/`, `.gitignore`).
- YouTube 오디오를 내려받지 않는다 (약관 위반).
- YouTube 플레이어는 최소 200×200px로 보이게 두고 위를 덮지 않는다.
- 화면 표기 제목은 `pieces.json`을 쓴다 (krn 메타데이터 아님).
- 악보 출처(CC BY-NC-SA 4.0, Craig Stuart Sapp)를 페이지 하단에 표기한다.
- 플레이어는 `AudioSource` 뒤에 숨긴다. 악보·싱크 코드는 YouTube를 직접 부르지 않는다.
