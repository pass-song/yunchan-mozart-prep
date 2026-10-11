# 공연 예습 페이지 (yunchan-mozart-prep)

목표: 공연 프로그램의 곡들을 YouTube 연주 영상으로 들으며 Verovio로 그린 악보를 함께 보는 정적 웹앱. 공연을 여러 개 담는다. 첫 공연은 임윤찬 모차르트 피아노 소나타 시즌2(2026). 처음 설계는 `DESIGN.md`(로컬에만 있음, 커밋하지 않음).

배포: `main`에 push → GitHub Actions(`.github/workflows/deploy.yml`) → https://pass-song.github.io/yunchan-mozart-prep/ . 빌드 base는 `/yunchan-mozart-prep/`(vite.config.ts), data 경로는 `assetUrl()`로 붙인다.

## 명령

- `npm run dev` — 개발 서버
- `npm test` — 단위 테스트 + 공연 데이터·악보 렌더 검사 (vitest, `tests/`)
- `npm run build` — 타입 검사 + 빌드
- `npx tsc` — 타입 검사만
- `npm run score-info -- <악보 파일> [미리보기.svg]` — 악보 하나를 Verovio로 읽어 마디 수·마지막 마디·박자·보표 수 요약
- `/add-piece` — 새 곡 추가 (아래 "새 곡 추가")

## 폴더 구조

```
data/                          # Vite publicDir. pieces.json 안의 경로는 data/ 기준
├─ concerts/
│  ├─ index.json               # { "concerts": [공연ID…] } 첫 화면 순서
│  └─ <공연ID>/pieces.json     # 공연 정보·녹음·악보 출처·곡·악장 (곡 순서 = 공연 순서)
├─ scores/<출처ID>/            # 출처별 원본 악보(수정하지 않는다) + LICENSE 파일 필수
│  └─ craigsapp-mozart/        #   craigsapp/mozart-piano-sonatas .krn, CC BY-NC-SA 4.0
├─ timings/                    # 타이밍 맵 (현재 쓰지 않음)
└─ notes/                      # 악장별 해설 마크다운 (현재 비어 있음)
.claude/commands/add-piece.md  # /add-piece 명령
audio/                         # 구매 음원 (커밋하지 않는다)
tools/score-info.mjs           # 악보 렌더 확인 도구
src/
├─ data.ts                     # pieces.json 스키마, assetUrl, piecesPath, scorePaths
├─ audio/                      # AudioSource, YouTubeSource(+TimeInterpolator 보간), MovementPlayer(악장 구간 재생·자동 다음 악장)
├─ score/                      # ScoreView(긴 한 장 렌더), scoreFormat(형식 판별·읽기), measureIds, performOrder
├─ sync/                       # (화면에서 뺌) SyncEngine, anchors(기준점 보간)
├─ ui/                         # (화면에서 뺌) TapRecorder
└─ main.ts                     # 화면 전환(공연 목록 → 곡 목록 → 영상+악보)
tests/                         # 단위 테스트, concerts.test.ts(데이터·렌더 검사), fixtures/(형식별 작은 악보)
```

## 데이터 (`data/concerts/<공연ID>/pieces.json`)

```jsonc
{
  "concert": { "title": "…", "performer": "…", "date": "YYYY-MM-DD", "venue": "…" },
  "recordings": { "<녹음ID>": { "label": "손열음 (토마토클래식)" } },
  "scoreSources": [{ "name": "…", "url": "…", "license": "CC BY-NC-SA 4.0", "licenseUrl": "…" }],
  "pieces": [{
    "id": "k282", "title": "(선택) 화면 표기", "k": "K.282", "no": 4, "key": "E♭장조",
    "movements": [{
      "id": "k282-1", "index": 1, "title": "Adagio",
      "score": "scores/craigsapp-mozart/sonata04-1.krn",   // 배열이면 이어 붙임, null이면 영상만
      "recordingId": "son-naive-2023",
      "audio": { "type": "youtube", "videoId": "_mrNwOqwtw8", "start": 0, "end": 335 }   // 초, end null = 영상 끝
    }]
  }]
}
```

- 곡 이름 표기: `title` → 없으면 `k` → 없으면 `id`.
- 악보 형식: `.krn`(Humdrum) `.musicxml`/`.xml`(MusicXML) `.mxl`(압축 MusicXML) `.mei`. 확장자로 판별(`src/score/scoreFormat.ts`).
- 악보를 구할 수 없으면 `score: null` → 곡 목록에 "악보 없음", 재생 화면은 영상만.
- 같은 영상 안에서 악장 구간이 겹치면 안 된다. 공연 ID·곡 ID·악장 ID는 소문자·하이픈.
- 하단 출처는 공연의 `scoreSources`에서 그린다. 악보가 있는 공연은 `scoreSources` 필수.

## 새 곡 추가

`/add-piece <공연> | <곡 이름> | <악보 출처 또는 "없음"> | <YouTube 링크> | <악장별 시간표>` (자세한 절차는 `.claude/commands/add-piece.md`)

1. **악보 받기**: 재배포가 허용된 라이선스만(공개 저장소에 올라간다). `data/scores/<출처ID>/`에 원본 그대로, 폴더에 LICENSE 파일. 없으면 `score: null`.
2. **렌더 확인**: `npm run score-info -- <파일>` — 마디 수·마지막 마디 번호·박자·보표 수가 실제 악보와 맞는지.
3. **pieces.json 추가**: 공연 순서대로. 새 공연이면 폴더를 만들고 `concerts/index.json`에 ID 추가. 새 녹음은 `recordings`, 새 악보 출처는 `scoreSources`에. 영상은 oEmbed로 공개·퍼가기 여부 확인(200 정상, 401 퍼가기 금지).
4. **테스트**: `npx tsc && npm test` — `tests/concerts.test.ts`가 데이터와 모든 악보 렌더를 검사. 데이터를 고쳐 통과시킨다.
5. **커밋·push**: 추가한 파일만 커밋 → push → `gh run watch`로 배포 확인.

## 화면

- 주소: `#/` 공연 목록 → `#/<공연ID>` 곡·악장 목록 → `#/<공연ID>/<악장ID>` 영상+악보. 예전 주소 `#k331-3`은 첫 공연의 그 악장으로.
- 재생은 `audio.start`~`end`만. 매 프레임 영상 시각이 같은 영상의 어느 악장 구간에 있는지로 현재 악장을 정하고(`MovementPlayer`), 맞는 악장이 없으면 다음 곡 영상으로. 재생 화면을 떠나면 멈춘다.
- 악보는 페이지로 나누지 않는다. 악장 전체를 화면 폭에 맞춘 긴 한 장으로 그리고 손으로 세로 스크롤한다. 악장이 바뀌면 맨 위로.
- 악보 크기(Verovio scale)는 상단 −/+ (15~80%, 5단위), localStorage `score-scale`. 기본값 폰(폭 600px 미만) 20%, PC 40%.
- 자동 넘김·마디 하이라이트·방향키 넘김·타이밍 맵은 없다(2026-10-11 결정). 탭 모드·싱크 모듈(`SyncEngine`, `TapRecorder`, `AnchorEditor`, `performOrder`, `measureDurations`)과 테스트는 남아 있다.
- 여러 파일로 나뉜 악장(K.331 1악장)은 Verovio가 한 번에 못 읽어서 파일마다 툴킷을 따로 두고 이어 붙인다.

## 마디 ID 규칙

마디 ID는 문자열이며 악보 파일의 마디 번호(MEI `@n`)를 그대로 쓴다 (`src/score/measureIds.ts`).

- `"0"` = 못갖춘마디 (번호 없는 첫 마디. MusicXML `number="0"`도 `"0"`)
- 1·2번 괄호(volta)는 원본처럼 각자 다른 번호. 예: K.331 3악장 1번 괄호 = `"96"`, 2번 괄호 = `"97"`. a/b 접미사는 쓰지 않는다.
- 번호 없는 중간 마디(반복 기호에서 쪼개진 조각, 카덴차) = 직전 마디 ID + `.1`, `.2` … 예: `"8.1"`, `"173.2"`

## 타이밍 맵 스키마 (현재 쓰지 않음)

연주된 순서대로의 마디 목록: `{ movementId, recordingId, audioOffset, events: [{ t, m, anchor? }] }`. `t`는 영상 기준 초(단조 증가), `m`은 마디 ID, `anchor: true`는 기준점 모드에서 직접 탭한 마디.

## 규칙

- 음원 파일은 커밋하지 않는다 (`/audio/`, `.gitignore`).
- YouTube 오디오를 내려받지 않는다 (약관 위반).
- YouTube 플레이어는 최소 200×200px로 보이게 두고 위를 덮지 않는다.
- 화면 표기 제목은 `pieces.json`을 쓴다 (악보 파일 메타데이터 아님).
- 악보 원본 파일은 수정하지 않는다. 출처·라이선스를 페이지 하단(`scoreSources`)과 README에 표기한다.
- 플레이어는 `AudioSource` 뒤에 숨긴다. 악보 코드는 YouTube를 직접 부르지 않는다.
