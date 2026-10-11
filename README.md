# 임윤찬 모차르트 리사이틀 예습 페이지

임윤찬 **모차르트 피아노 소나타 시즌2** 리사이틀(2026-11-26 김해문화의전당 외) 프로그램 5곡 15개 악장을
YouTube 연주 영상으로 들으며 악보를 함께 보는 정적 웹 페이지입니다.

**페이지:** https://pass-song.github.io/yunchan-mozart-prep/

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
npm test
npm run build    # dist/
```

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트·빌드 후 GitHub Pages에 배포합니다.

## 출처와 라이선스

- **악보 데이터** (`data/scores/`): Craig Stuart Sapp, *A digital edition of Mozart piano sonatas from volume 20 of
  the Alte Mozart-Ausgabe (1878)*, © 2004–2018,
  [craigsapp/mozart-piano-sonatas](https://github.com/craigsapp/mozart-piano-sonatas).
  [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 라이선스이며, 원본 Humdrum 파일을 수정 없이
  복사했습니다(`data/scores/LICENSE.txt`). 페이지에서는 이 파일을 Verovio로 조판해 표시합니다.
  비영리 목적으로만 쓸 수 있고, 이 악보 데이터를 바탕으로 한 결과물은 같은 라이선스를 따라야 합니다.
- **악보 렌더러**: [Verovio](https://www.verovio.org) (`verovio` npm 패키지), LGPL-3.0-or-later.
- **음원**: YouTube IFrame Player로 각 채널의 공개 영상을 재생만 합니다. 영상의 권리는 각 채널·연주자에게 있으며,
  이 저장소는 영상·음원을 포함하지 않습니다.
