# 편집 대상 정의 독립 검증 안내

Claude 등 다른 코딩 환경에서 편집 대상 정의와 기존 기능의 일치 여부를 재검증하는 문서다.
GitHub 접근 권한이 있다는 전제로 작성했다. 검증 결과를 재현하려면 저장소 읽기 권한 외에
명령 실행 환경도 필요하다. GitHub 커넥터만 있고 실행 환경이 없다면 코드 검토만 가능하며,
그 결과를 테스트 통과로 보고하면 안 된다.

## 검증할 버전

- 저장소: https://github.com/AIWise-EUR/AIWiseModule_Beta
- 개편 브랜치: `refactor/editor-core-2026-11-12`
- 고정 검증 커밋: `4dbc2c10433b08ce3d396ac4a3209f97cdf057af`
- 개편 전 비교 기준: `backup/editor-pre-refactor-2026-11-12` (`c444116`)
- 1차 함수 개편 커밋: `766b85c`
- 대상 정의: `docs/editor-target-model.md`
- 조사 프로그램: `checks/editor-target-audit.cjs`
- 대상 정의 테스트: `workspace/tests/editor-target-audit.test.cjs`
- 함수 개편 테스트: `workspace/tests/editor-operations.test.cjs`
- 브라우저 검사: `workspace/tests/editor-operations.browser.cjs`

브랜치의 최신 HEAD는 이 안내 문서 등의 후속 변경을 포함할 수 있다.
동일한 결과를 비교하려면 먼저 위 고정 커밋에서 실행한다.
사용자 초안, 번역, 저장 형식과 기존 기능 보존이 우선이다. 이번 검증은 코드·자료를
읽고 테스트하는 작업이며, 운영 사이트 배포·승인·게시·실데이터 변경은 포함하지 않는다.

## 준비

macOS 또는 Linux의 Git, POSIX shell, Perl과 Deno가 필요하다. Windows에서는 WSL 등
동일한 실행 환경을 사용한다. 기존 검증 환경은 Deno 2.9.7이었으며, 실제 사용한 버전을
결과에 기록한다. 다른 버전에서의 실패는 먼저 환경 차이와 코드 문제를 구분한다.

기존 작업 폴더를 바꾸거나 초기화하지 말고 별도 worktree 또는 새 clone을 사용한다.
이미 저장소를 가지고 있다면 그 저장소 안에서:

```sh
git fetch origin refactor/editor-core-2026-11-12 --tags
audit_root="$(mktemp -d "${TMPDIR:-/tmp}/aiwise-editor-audit.XXXXXX")"
git worktree add --detach "$audit_root/repo" 4dbc2c10433b08ce3d396ac4a3209f97cdf057af
cd "$audit_root/repo"
git rev-parse HEAD
git status --short
mkdir -p "$audit_root/results"
```

새 clone이 필요한 환경에서는 동일한 저장소를 별도 디렉터리에 clone하고 고정 커밋을
checkout한다. 아래 명령의 `audit_root`는 검증용 디렉터리로 설정한다.
이 문서 자체는 검증 커밋 이후에 추가되므로 checkout 전에 별도로 열어 둔다.

Deno가 PATH에 있다면 다음처럼 지정한다. 없다면 설치되어 있는 Deno의 실제 절대 경로를
`DENO`에 지정하거나 환경 정책에 따라 설치한다.

```sh
export DENO="$(command -v deno)"
"$DENO" --version
export AIWISE_TEST_DEPS="${AIWISE_TEST_DEPS:-$HOME/.cache/aiwise-test-deps}"
```

전체 테스트 실행기는 의존성이 없으면 저장소 밖의 위 캐시에 `linkedom@0.18.12`와
`@electric-sql/pglite@0.3.14`를 설치한다. 최초 설치에는 네트워크가 필요하다.
실제 테스트는 운영 서비스에 연결하지 않고, 일부 테스트용 서버에 로컬 포트 8000이 필요하다.
포트 충돌이나 실행 권한 오류가 나면 기존 프로세스를 임의 종료하지 말고 환경 문제로 보고한다.

## 필수 검사

### 전체 회귀 검사

```sh
sh checks/run-tests.sh > "$audit_root/results/full-tests.log" 2>&1
audit_status=$?
cat "$audit_root/results/full-tests.log"
test "$audit_status" -eq 0
```

고정 커밋에서는 **64개 테스트 파일**이 통과하고 마지막에 `All test files passed.`가
나와야 한다. 이는 64개의 개별 테스트 케이스라는 뜻이 아니다.
종료 코드도 확인한다. 실패 시 실행기가 출력한 임시 로그 경로에서 상세 로그를 보존한다.
테스트 파일이나 기대값을 수정하여 통과시키지 않는다.

### 대상 정의 검사와 전체 대응 목록

전체 실행 후 같은 shell에서:

```sh
export LINKEDOM_MODULE="$AIWISE_TEST_DEPS/node_modules/linkedom"
"$DENO" test --no-prompt --allow-read=.,"$AIWISE_TEST_DEPS" --allow-env workspace/tests/editor-target-audit.test.cjs
"$DENO" run --no-prompt --allow-read=.,"$AIWISE_TEST_DEPS" --allow-env checks/editor-target-audit.cjs > "$audit_root/results/target-summary.json"
"$DENO" run --no-prompt --allow-read=.,"$AIWISE_TEST_DEPS" --allow-env checks/editor-target-audit.cjs --details > "$audit_root/results/target-details.json"
```

대상 정의 테스트는 **5개 검사 통과**가 예상된다. 요약 JSON의 기대값은 다음과 같다.

| 항목 | 고정 커밋의 값 |
|---|---:|
| 공통 묶음 / 원본 필드 | 243 / 879 |
| 과목용 선언 슬롯 | 18 |
| 학과 / 과목 | 3 / 4 |
| 저장소 승인본 | 19 |
| 조사 자료의 일반 문자열·선택값 필드 출현 수 | 3,818 |
| 추가 박스 / 내부 서식 텍스트 필드 출현 수 | 44 / 88 |
| 별도 서식 레코드 출현 수 | 3 |
| `summary.unexplained` / `issues` | 0 / 빈 배열 |

출현 수에는 원본과 언어별 승인본의 반복 검사가 포함된다. 고유 콘텐츠 수나 Neus의
브라우저 데이터 수가 아니다. 새로운 승인본이 추가된 다른 커밋에서는 수치가 달라질 수 있다.

### 독립적인 규칙 검토

테스트 통과만으로 결론 내리지 말고 원래 코드와 대상 정의를 비교한다.

1. `workspace/content-studio.js`, `workspace/studio-editing.js`,
   `workspace/common-studio.js`, `workspace/layout-sync.js`,
   `pipelines/common-content.js`, `pipelines/course-loader.js`를 읽는다.
2. 실제 대상 하나가 형태·소속·저장·표시·언어·허용 동작의 조합으로 설명되는지 확인한다.
   설명되지 않는 대상, 범위가 지나치게 넓은 규칙, 숨겨진 예외가 있다면 기록한다.
3. 특히 공유 제목과 예시별 제목, SVG/속성/맵 원본의 서식,
   가변 예시 목록과 고정 Markdown/XML 목록, XML tag의 구조 동기화,
   네 번째 섹션의 지연 생성과 구형 ID 호환, 구형 Dutch 경로의 Undo 정책을 확인한다.
4. 조사 프로그램이 자기 분류만 검사하는 부분과 실제 구현을 대조하는 부분을 구분한다.
   0개의 미분류 결과가 모든 동작의 정확성을 보장하는지 따로 평가한다.

저장소 자료의 검증은 실제 사용자 브라우저나 운영 데이터베이스 상태까지 보장하지 않는다.
현재 대상 정의 모델은 운영 코드에 연결되지 않은 검증용 모델이라는 점도 유지한다.

## 추가 브라우저 검사

명령 실행과 브라우저 실행이 가능한 환경에서 권장한다. 전체 테스트 실행기는
`*.browser.cjs`를 자동 실행하지 않는다. Node.js, Playwright, 실행 가능한 Chrome 또는
Chromium을 별도로 준비하고, 해당 환경의 실제 경로를 사용한다.

```sh
export PLAYWRIGHT_MODULE=/absolute/path/to/playwright
export CHROMIUM_PATH=/absolute/path/to/chrome-or-chromium
export EDITOR_RESULT_PATH="$audit_root/results/refactor-browser.json"
node workspace/tests/editor-operations.browser.cjs > "$audit_root/results/browser.log" 2>&1
audit_status=$?
cat "$audit_root/results/browser.log"
test "$audit_status" -eq 0
```

고정 커밋에서는 **20개 scope/chapter/language 조합의 편집·저장·복원**, C2 카드 이동,
**14개의 가상 제출**이 통과해야 한다. 나머지 6개는 기존 소스 검토 조건에 의해 제출이
제한되는 상태다. 제한을 해제해서 통과시키지 않는다. 테스트는 별도 임시 브라우저를
사용하고 테스트 서버 밖의 네트워크 요청을 차단한다.

개편 전후 비교도 가능하다. 같은 저장소에서:

```sh
mkdir -p "$audit_root/baseline"
git show backup/editor-pre-refactor-2026-11-12:workspace/studio-editing.js > "$audit_root/baseline/studio-editing.js"
git show backup/editor-pre-refactor-2026-11-12:workspace/content-studio.js > "$audit_root/baseline/content-studio.js"
EDITOR_SOURCE_DIR="$audit_root/baseline" EDITOR_RESULT_PATH="$audit_root/results/baseline-browser.json" node workspace/tests/editor-operations.browser.cjs > "$audit_root/results/baseline-browser.log" 2>&1
```

두 JSON 결과를 객체 기준으로 비교한다. 검사 프로그램은 `savedAt`만 제외한 저장 레코드와
제출 가능 여부를 기록하므로 20개 항목이 일치해야 한다. 이 비교는 같은 고정 커밋의 자료와
나머지 런타임을 사용하면서 두 편집 스크립트만 교체하는 검사다. 과거 시스템 전체의 복원
검사로 확대 해석하지 않는다.

## 결과 보고 형식

- 실행 커밋, 운영체제, Deno/Node/브라우저 버전.
- 전체 테스트: 통과 파일 수, 실패 파일, 종료 코드, 로그 위치.
- 대상 검사: 5개 검사 결과, 미분류 항목, 주요 집계 차이.
- 브라우저: 실행 또는 미실행, 20개 조합과 가상 제출 결과, 전후 데이터 비교 결과.
- 독립 검토: 기존 규칙으로 설명되지 않는 사례와 코드 위치, 재현 방법, 영향.
- 구분: 기존부터 있던 문제 / 개편으로 생긴 문제 / 검증 환경 문제 / 추가 확인 필요.
- 기존 코드·콘텐츠·실사용자 데이터 변경 여부와 최종 `git status --short`.

## Claude에 전달할 프롬프트

AI-Wise 편집 대상 정의와 함수 개편을 독립적으로 검증해줘.

저장소는 `AIWise-EUR/AIWiseModule_Beta`, 브랜치는 `refactor/editor-core-2026-11-12`,
검증 커밋은 `4dbc2c10433b08ce3d396ac4a3209f97cdf057af`야. GitHub 접근 권한은 있어.
브랜치의 `docs/editor-audit-handoff.md`를 먼저 읽고, 별도 worktree 또는 새 clone에서
고정 커밋을 검증해줘. 해당 안내 문서는 검증 커밋 이후에 추가됐으니 먼저 읽어 둬.

핵심 질문은 “새 대상 정의가 기존 대상과 동작을 빠짐없이 설명하며, 기존 기능·저장 형식·
번역·초안 보존 조건을 유지하는가?”야. 문서와 테스트 결과를 그대로 믿지 말고 실제 구현과
비교해줘. 단순한 수치 일치와 실제 동작 검증을 구분해줘.

필수로 전체 회귀 테스트, 대상 정의 5개 검사, 상세 대상 목록 생성을 수행해줘.
가능하면 안내 문서의 20개 조합 브라우저 검사와 개편 전후 저장 결과 비교도 실행해줘.
검사 환경이 없으면 미실행으로 명시하고, 코드 검토를 실제 실행 결과로 표현하지 마.

이번 작업은 검증과 보고만 해줘. 기존 작업 폴더, 운영 사이트, Supabase 실데이터,
사용자 브라우저 저장소를 변경하지 말고 승인·게시·배포도 하지 마.
실패한 테스트의 기대값이나 구현을 수정해 통과시키지 마.

결과는 실행 커밋과 환경, 검사별 통과·실패·미실행, 설명되지 않는 대상 또는 규칙,
기존 문제와 개편 회귀의 구분, 재현 방법과 파일 위치, 로그 위치로 정리해줘.
분류가 과도하게 복잡하거나 기존 구현에 맞춘 임시 예외가 많다면 그 점도 비판적으로 평가해줘.
