---
description: 공연에 새 곡을 추가한다 (악보 받기 → 렌더 확인 → pieces.json → 테스트 → 커밋·push)
argument-hint: <공연ID 또는 새 공연> | <곡 이름> | <악보 출처 URL 또는 "없음"> | <YouTube 링크> | <악장별 시간표>
---

새 곡을 예습 페이지에 추가한다. 입력: $ARGUMENTS

CLAUDE.md의 "새 곡 추가" 절과 데이터 규칙을 따른다. 단계마다 한 줄로 진행 상황을 알린다.

## 0. 입력 확인

다음이 모두 있어야 한다. 빠진 것이 있으면 AskUserQuestion으로 한 번에 묻고, 나머지는 추측하지 않는다.

- **공연**: `data/concerts/index.json`에 있는 공연 ID, 또는 새 공연(제목·연주자·날짜 YYYY-MM-DD·장소).
  새 공연이면 ID는 `<연주자>-<주제>-<연도>` 형태의 소문자·하이픈 (예: `lim-mozart-s2-2026`).
- **곡 이름**: 화면 표기 이름. 조성·작품번호가 있으면 `key`, `k`에 따로 넣는다.
- **악보 출처**: URL(저장소·파일) 또는 "없음".
- **YouTube 링크**: 악장마다 같은 영상이면 하나, 다르면 악장별로.
- **악장별 시간표**: `1. Allegro 0:00–5:35` 형식. 끝을 모르면(마지막 악장의 박수 전 등) 비워 둔다 → `end: null`.
- **연주자 표기**: 녹음 라벨 (예: "손열음 (토마토클래식)"). 기존 `recordings`에 있으면 그 ID를 쓴다.

## 1. 악보 받기

- 출처가 "없음"이면 `score: null`로 두고 3단계로 간다 (영상만 재생된다).
- 읽을 수 있는 형식: `.krn`(Humdrum) `.musicxml` `.xml` `.mxl` `.mei`. PDF·이미지·LilyPond·MuseScore(.mscz)는 쓸 수 없다.
- **라이선스를 먼저 확인한다.** 공개 저장소에 올리고 재배포하므로 퍼블릭 도메인·CC 등 재배포가 허용된 것만 쓴다.
  라이선스가 없거나 재배포 금지면 받지 말고 사용자에게 알린 뒤 `score: null`로 진행할지 묻는다.
- 출처별 폴더 `data/scores/<출처ID>/`에 원본 그대로 저장한다(수정 금지). 출처ID는 소문자·하이픈 (예: `craigsapp-mozart`).
  이미 있는 출처 폴더면 거기에 추가한다.
- 그 폴더에 `LICENSE` 파일이 없으면 만든다: 원본 저장소의 LICENSE를 그대로 받거나, 없으면 저작자·출처 URL·라이선스명·라이선스 URL을 적은 `LICENSE.txt`.
- 받기는 `curl -sfL -o <경로> <raw URL>`. GitHub는 `raw.githubusercontent.com` 주소를 쓴다.
- 악장이 여러 파일로 나뉘어 있으면(변주곡 등) 순서대로 모두 받고 `score`를 배열로 둔다.

## 2. 렌더 확인

받은 파일마다:

```
npm run score-info -- data/scores/<출처ID>/<파일>
```

- `measures` > 0, `last`(마지막 마디 번호)가 실제 악보와 맞는지, `meters`(박자)·`staves`(피아노는 2)가 그럴듯한지 본다.
- `title`이 다른 곡이면 잘못 받은 파일이다.
- 읽기 실패하면 다른 형식(예: .mxl 대신 .musicxml)이 있는지 찾고, 없으면 사용자에게 알리고 `score: null`로 진행할지 묻는다.

## 3. pieces.json 추가

대상: `data/concerts/<공연ID>/pieces.json`. 새 공연이면 폴더와 파일을 만들고 `data/concerts/index.json`의 `concerts`에 ID를 추가한다(첫 화면에 보이는 순서).

```jsonc
{
  "id": "k545",                       // 공연 안에서 고유. 소문자·하이픈
  "title": "피아노 소나타 16번 K.545",   // 화면 표기 (없으면 k)
  "k": "K.545", "key": "C장조",        // 있으면
  "movements": [
    {
      "id": "k545-1", "index": 1, "title": "Allegro",
      "score": "scores/<출처ID>/<파일>",  // data/ 기준. 여러 파일이면 배열, 없으면 null
      "recordingId": "son-naive-2023",
      "audio": { "type": "youtube", "videoId": "XXXXXXXXXXX", "start": 0, "end": 335 }
    }
  ]
}
```

- `videoId`: 링크에서 뽑는다 (`youtu.be/<id>`, `watch?v=<id>`, `/live/<id>`, `/shorts/<id>`). 11자. `t=` 등 나머지는 버린다.
- `start`·`end`: 초 단위 정수(시간표의 `m:ss`·`h:mm:ss`를 변환). 같은 영상 안에서 악장 구간이 겹치면 안 된다.
- 곡 순서 = 공연 프로그램 순서. 사용자가 위치를 말하지 않았으면 맨 뒤에 넣는다.
- 새 녹음이면 `recordings`에 `{ "<ID>": { "label": "<연주자 표기>" } }`를 추가한다.
- 새 악보 출처면 `scoreSources`에 `{ name, url, license, licenseUrl }`를 추가한다(페이지 하단 출처 표기).
- 영상 확인: `curl -s -o /dev/null -w "%{http_code}" "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json"`
  - 200 정상, 401 퍼가기 금지(페이지에서 재생 안 됨), 400·404 없는 영상. 200이 아니면 사용자에게 알리고 다른 영상을 받을지 묻는다.

## 4. 테스트

```
npx tsc
npm test
```

`tests/concerts.test.ts`가 데이터(ID 중복, 녹음 ID, 영상 구간 겹침, 악보 파일·라이선스)와 모든 악보 렌더링을 검사한다.
실패하면 데이터를 고친다. 테스트를 고쳐서 통과시키지 않는다.

## 5. 커밋·push

- `git status`로 이번에 추가·수정한 파일만 있는지 확인하고, 그 파일만 `git add` 한다.
- 커밋 메시지: `<공연 제목>: <곡 이름> 추가` (+ 악보 출처 한 줄).
- `git push` 후 `gh run watch <run id> --exit-status`로 배포 결과를 확인한다.

## 6. 보고

- 추가한 곡·악장과 각 구간(분:초), 악보 출처와 라이선스(또는 "악보 없음")
- 확인 주소: `https://pass-song.github.io/yunchan-mozart-prep/#/<공연ID>/<첫 악장ID>`
- 사용자가 직접 볼 것: 악보가 맞는 곡인지, 악장 시작·끝 시각이 맞는지
