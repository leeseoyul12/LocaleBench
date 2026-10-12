# LocaleBench 실행과 Google 연결

## 현재 준비된 것

React/TypeScript 앱, 실제 DOM 검사, 로컬 저장, 사용자별 D1 저장, ChatGPT 로그인 연동, 서버 전용 Google Basic v2 번역, DB 마이그레이션과 테스트가 구현되어 있습니다. Sites 프로젝트는 이미 만들어져 있으므로 새 프로젝트를 만들지 않습니다. 프로젝트 ID는 `.openai/hosting.json`의 값을 재사용합니다.

Google 키는 아직 제공되지 않았습니다. 샘플 번역은 직접 작성한 데모 데이터이며 Google 호출 성공을 뜻하지 않습니다. 실제 Google 호출 검증은 키 연결 후 진행합니다.

## Windows 로컬 실행

Node.js 24와 Git을 사용합니다. 이 PC에 설치한 Node 위치는 `C:\Users\나\.codex\tools\localebench\node-v24.21.0-win-x64`입니다. 새 PowerShell에서 다음을 실행합니다.

```powershell
$env:Path = 'C:\Users\나\.codex\tools\localebench\node-v24.21.0-win-x64;' + $env:Path
Set-Location 'C:\Users\나\Desktop\학교\응프\localebench'
npm run dev -- --host 127.0.0.1 --port 5173
```

`http://127.0.0.1:5173`에서 열립니다. 개발 서버의 로그인은 **로컬 모의 계정**입니다. 실제 ChatGPT 계정 인증은 배포된 Sites의 게이트웨이가 처리합니다. 로컬 개발 서버는 루프백에만 바인딩합니다.

다른 컴퓨터의 첫 설치:

```sh
npm run install:ci
npm run build
npm run db:local
npm run dev -- --host 127.0.0.1 --port 5173
```

`db:local`은 빈 로컬 DB에 초기 마이그레이션을 적용합니다. 이미 적용한 DB에서는 다시 실행하지 않습니다. 추가 스키마 변경은 `npm run db:generate`로 **새 마이그레이션**을 만들고 해당 파일만 순서대로 적용합니다. 로컬 DB와 배포 DB는 별개입니다. Sites가 배포 전에 호스팅 DB 마이그레이션을 적용합니다.

Windows에서는 프로덕션 Worker가 빌드 파일을 잠글 수 있습니다. `npm start`를 종료한 후 `npm run build`를 실행합니다. Sites의 범용 Windows 빌드 래퍼에서 npm 경로 문제가 관찰되어 이 프로젝트는 같은 starter의 `npm run build` / `node scripts/run-framework.mjs build`를 직접 사용합니다.

## 사용자가 필요한 Google 단계

계정 로그인과 결제 연결은 사용자 계정에서 해야 합니다. 프로젝트를 새로 만드는 경우 다음을 수행합니다.

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 선택하거나 만듭니다.
2. 필요하면 해당 프로젝트에 결제를 연결합니다.
3. [Cloud Translation API 활성화](https://console.cloud.google.com/apis/library/translate.googleapis.com)를 실행합니다.
4. [API 및 서비스 → 사용자 인증 정보](https://console.cloud.google.com/apis/credentials)에서 API 키를 만듭니다. API 제한을 **Cloud Translation API만 허용**하도록 설정합니다.
5. 서비스는 서버에서 호출하므로 브라우저 HTTP referrer 제한을 쓰지 않습니다. 현재 Workers의 고정 외부 IP를 확인하지 못했으므로 임의 IP 제한을 설정하지 않습니다.
6. Cloud Console에서 API 할당량과 결제 예산 알림을 설정합니다. 예산 알림은 자동 과금 차단 장치가 아닙니다.

공식 근거: [Translation Basic v2 인증](https://cloud.google.com/translate/docs/authentication), [프로젝트 설정](https://cloud.google.com/translate/docs/setup), [API 키 보안](https://cloud.google.com/docs/authentication/api-keys-best-practices).

키를 채팅, Git, 프론트엔드 설정에 넣지 않습니다. 로컬에서는 루트의 무시되는 `.env.local` 파일에 다음 한 줄을 입력합니다.

```dotenv
GOOGLE_TRANSLATION_API_KEY=사용자가_발급한_실제_키
```

Wrangler 프로덕션 로컬 실행에는 `.dev.vars`를 사용할 수 있습니다. 두 파일 모두 Git에서 제외됩니다. `npm run check:env`는 값 없이 설정 유무만 보여 줍니다. 파일 저장 후 개발 서버를 재시작하고 **연결 및 설정 → 연결 상태 새로고침**을 누릅니다.

호스팅에서는 Sites의 **서버 런타임 비밀 환경변수** `GOOGLE_TRANSLATION_API_KEY`를 설정해야 합니다. 로컬 파일이 배포 비밀값으로 자동 업로드되지는 않습니다. 키를 로컬 파일에 저장한 뒤 에이전트에게 연결을 지시하면 파일에서 메모리로 읽어 Sites 도구에 전달할 수 있습니다. 키 값은 로그·커밋·문서에 남기지 않습니다. 프로젝트를 다시 생성하거나 별도 Supabase/OpenAI 키를 발급할 필요는 없습니다.

## 키 연결 후 실제 확인

1. 배포 사이트에 로그인합니다.
2. 작은 프로젝트에 `{"hello":"Hello, {name}"}`를 가져옵니다.
3. 클라우드 저장 후 독일어를 선택하여 **Google 번역**을 한 번 실행합니다.
4. `{name}`이 유지되는지 확인하고 UI 검사를 실행합니다.
5. 동일 원문을 다시 번역하여 캐시 안내가 나오는지 확인합니다.
6. 입력·번역·실측 보고서를 내보내 증거를 보관합니다.

이 검증은 실제 Google 요청을 발생시킵니다. 키를 연결하기 전까지 완료로 기록하지 않습니다. 무료 할당량이나 특정 요금이 계속 유지된다고 가정하지 않습니다.

## 앱의 비용 제어

자동 번역은 버튼으로 명시적으로 실행됩니다. 자동 유료 재시도는 없습니다. 입력은 최대 18,000자/요청, 예약량은 사용자별 20,000자/일, 앱 전체 100,000자/일이며 날짜 경계는 한국 시간 자정입니다. 변수 마스킹 추가 길이를 보수적으로 예약하고 실패도 반환하지 않으므로 Google의 실제 청구량과 다릅니다. 동일 사용자·원문·대상 언어 캐시는 추가 호출을 막습니다. 전역 한도에서 차단될 때 개인 예약량이 일부 소비될 수 있으며 안전한 쪽으로 처리합니다.

Worker가 호출 중 중단되면 동일 입력의 `running` 기록은 재청구 방지를 위해 잠긴 상태로 남습니다. 임의로 자동 재시도하지 않습니다. 관리자는 Google 호출 상태를 확인한 뒤 해당 요청을 실패 상태로 정리해야 합니다. 일상적인 API 오류는 실패 상태로 기록되어 사용자 재시도가 가능합니다.

## 검증 명령

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

브라우저 검증은 개발 서버 5173이 필요합니다. 빌드된 Worker의 D1/API 검증은 별도 임시 DB에서 직접 실행합니다.

```sh
npm run test:browser
npm run test:worker
```

Windows는 설치된 Chrome을 사용합니다. CI에서는 Playwright Chromium을 설치합니다. A/B 권한 테스트의 인증 헤더는 **로컬 Worker 테스트 전용**이며 실제 호스팅 인증을 우회하는 절차가 아닙니다. 현재 Windows의 HTTP 프록시 경유 테스트에서 연결 재설정이 관찰되어 Worker 통합 검증은 Miniflare 직접 dispatch로 수행합니다. 호스팅 게이트웨이 로그인은 배포 후 별도로 확인해야 합니다.
