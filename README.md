# 공연 예습 페이지

공연 프로그램의 곡들을 YouTube 연주 영상으로 들으며 악보를 함께 보는 정적 웹 페이지입니다.
첫 화면에서 공연을 고르고, 곡·악장을 고르면 영상과 악보가 함께 나옵니다.

**페이지:** https://pass-song.github.io/yunchan-mozart-prep/

## 공연

### 임윤찬 모차르트 피아노 소나타 시즌2 (2026-11-26 김해문화의전당 외)

| 순서 | 곡 | 영상 |
| --- | --- | --- |
| 1 | 소나타 4번 K.282 | 손열음 (토마토클래식) |
| 2 | 소나타 13번 K.333 | 손열음 (토마토클래식) |
| 3 | 소나타 9번 K.311 | 임윤찬 (2022 반 클라이번 콩쿠르 예선) |
| 4 | 소나타 7번 K.309 | 손열음 (토마토클래식) |
| 5 | 소나타 11번 K.331 | 손열음 (토마토클래식) |

## 실행

```
npm install
npm run dev      # http://localhost:5173
npm test         # 단위 테스트 + 공연 데이터·악보 렌더 검사
npm run build    # dist/
```

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트·빌드 후 GitHub Pages에 배포합니다.

## 곡·공연 추가

- 공연: `data/concerts/<공연ID>/pieces.json`, 첫 화면 순서는 `data/concerts/index.json`
- 악보: `data/scores/<출처ID>/` (Humdrum `.krn`, MusicXML `.musicxml`·`.xml`·`.mxl`, MEI `.mei`). 악보가 없으면 영상만 재생
- Claude Code에서 `/add-piece` 명령으로 악보 받기 → 렌더 확인 → 데이터 추가 → 테스트 → 커밋·push를 한 번에 진행합니다.
  절차는 `CLAUDE.md`의 "새 곡 추가"와 `.claude/commands/add-piece.md`에 있습니다.

## 출처와 라이선스

- **악보 데이터** (`data/scores/<출처ID>/`): 출처마다 폴더에 원본 라이선스 파일이 있고, 페이지 하단에도 공연별로 표기합니다.
  - `craigsapp-mozart/`: Craig Stuart Sapp, *A digital edition of Mozart piano sonatas from volume 20 of
    the Alte Mozart-Ausgabe (1878)*, © 2004–2018,
    [craigsapp/mozart-piano-sonatas](https://github.com/craigsapp/mozart-piano-sonatas).
    [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 라이선스이며, 원본 Humdrum 파일을 수정 없이
    복사했습니다(`data/scores/craigsapp-mozart/LICENSE.txt`). 페이지에서는 이 파일을 Verovio로 조판해 표시합니다.
    비영리 목적으로만 쓸 수 있고, 이 악보 데이터를 바탕으로 한 결과물은 같은 라이선스를 따라야 합니다.
- **악보 렌더러**: [Verovio](https://www.verovio.org) (`verovio` npm 패키지), LGPL-3.0-or-later.
- **음원**: YouTube IFrame Player로 각 채널의 공개 영상을 재생만 합니다. 영상의 권리는 각 채널·연주자에게 있으며,
  이 저장소는 영상·음원을 포함하지 않습니다.
