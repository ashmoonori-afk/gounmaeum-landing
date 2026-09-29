# 고운마음 랜딩 페이지

기업 경조사 플랫폼 **고운마음**의 소개(랜딩) 정적 웹사이트입니다.

- 라이브: https://gounmaeum-landing.vercel.app
- 구성: `site/` 폴더가 배포 루트입니다. 빌드 단계나 프레임워크 없이 HTML, CSS, JS로만 되어 있습니다.
- 도입 문의는 대표번호 1588-6764로 받습니다. (온라인 신청 폼은 접수 주소가 없어 제거했습니다.)

## 로컬 실행

```sh
bun qa/serve.mjs      # http://localhost:4173, 배포와 같은 응답 헤더로 site/ 를 제공합니다
```

## 배포

`site/` 폴더에서 `npx vercel deploy --prod` 로 배포합니다. 보안 헤더(CSP 포함)는 `site/vercel.json` 에 있으며,
`site/index.html` 의 인라인 스크립트를 바꾸면 CSP의 `sha256-` 해시도 다시 계산해야 합니다.
