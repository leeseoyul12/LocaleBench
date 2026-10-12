# LocaleBench

번역문이 UI에 맞는지 실제 브라우저로 검사하는 다국어 QA 작업공간입니다. Google Translation을 연결하거나 직접 번역문을 입력하고, 폰트·너비 매트릭스와 런타임 변수 시뮬레이션으로 문제를 찾은 뒤 수정 전후를 비교합니다.

## 구현 기능

- 영어 flat JSON 입력, 중복 키·크기·형식 검증, 독일어/프랑스어/한국어 편집
- 버튼·라벨·한줄 배너 fixture의 실제 DOM 수평 넘침 측정 및 추천 너비
- 로컬 폰트 2개 × 기본 너비 3개 × 언어 3개 조건 매트릭스
- `{name}`·단일 `%s` 변수 보호, 누락·추가·중복 검증, 기본/긴 값 시뮬레이션
- 불변 입력 스냅샷과 실행 이력, 동일 조건의 신규/지속/해결 오류 비교
- IndexedDB 저장, ChatGPT 인증과 소유자별 D1 저장, 클라우드 삭제
- 번역 JSON·실측 보고서·프로젝트 백업 내보내기와 백업 복원
- 서버 전용 Google Basic v2 호출, 캐시·중복 요청 제어·일일 문자 예약 한도
- 모바일 메뉴, 검색·필터, 키보드 대화상자 조작, 오류·빈 데이터·부분 실패 상태

샘플 번역은 직접 작성했습니다. Google 키 없이도 실제 DOM 검사가 가능합니다. **실제 Google 요청은 아직 검증되지 않았으며 API 키 연결 후 확인해야 합니다.**

## 실행

Node.js 24 권장. 첫 설치에서 아래 명령을 사용합니다.

```sh
npm run install:ci
npm run build
npm run db:local
npm run dev -- --host 127.0.0.1 --port 5173
```

이미 DB를 초기화한 이 PC에서는 `db:local`을 반복하지 않습니다. 로컬 주소는 `http://127.0.0.1:5173`입니다.

## 문서와 검증

- [실행·키 연결 안내](docs/SETUP.md)
- [구조·측정 범위·보안 설명](docs/ARCHITECTURE.md)
- [검증 결과와 제한](docs/QA.md)
- [수행평가 시연 시나리오](docs/DEMO.md)

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:worker
npm run test:browser
```

브라우저 테스트는 실행 중인 개발 서버가 필요합니다. CI 설정은 `.github/workflows/ci.yml`에 있으며 외부 GitHub 실행 결과는 아직 없습니다.

## 배포

Sites 프로젝트와 D1 바인딩은 `.openai/hosting.json`에 설정되어 있습니다. 배포는 동일 프로젝트에 Git 소스를 저장하고 해당 커밋에서 만든 Worker 아카이브를 비공개로 게시합니다. 호스팅 API 키는 Sites의 서버 비밀 환경변수로 별도 설정합니다. 새 Sites 프로젝트·Supabase 계정·OpenAI API 키를 만들 필요는 없습니다.

## 라이선스 자산

Noto Sans KR 5.3.1, IBM Plex Mono 5.3.0의 400 weight woff2를 로컬로 제공하며 `public/fonts`에 원 라이선스를 포함했습니다. Sites starter의 vendored 코드 라이선스도 해당 디렉터리에 유지합니다. 외부 폰트 CDN에 의존하지 않습니다.
