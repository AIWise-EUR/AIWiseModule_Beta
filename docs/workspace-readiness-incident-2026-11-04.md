# Workspace 승인 및 DPAS 등록 장애 분석

확인일 2026-11-04, 한국시간. 실제 데이터베이스, 함수 목록, 요청 메타데이터,
배포 코드 및 로컬 복제 검증을 구분해 기록한다. 실제 번역 요청을 승인하거나
학생 사이트를 발행하는 작업은 수행하지 않는다.

## 확인된 사실

| 문제 | 확인된 원인 | 사용자에게 미치는 영향 |
| --- | --- | --- |
| Common Studio 네덜란드어 승인 차단 | `workspace_studio_capabilities()`가 `blocks:1, sat_phases:1`만 반환. 승인 prepare/apply RPC는 존재하고 authenticated 실행 권한도 정상 | 프런트엔드가 승인 서비스 호출 전에 잘못된 미설치 안내로 중단 |
| 과목 공용 목록 연결 실패 | Supabase 함수 목록에 `workspace-courses` 없음. 최근 24시간 로그에 해당 경로 HTTP 404 6건 | 공용 목록 읽기 및 과목 등록 불가 |
| DPAS 선택 불가 | 저장소 registry 및 데이터베이스 content scopes에 DPAS 없음 | 과목 ID가 올바르더라도 소속 전공을 선택할 수 없음 |
| 화면 안내가 실제 원인을 충분히 설명하지 못함 | capability 누락을 기능 미설치로 단정. 브라우저에서 404 응답이 CORS로 가려지면 일반 연결 오류로 표시 | 사용자가 본인 입력이나 번역 작업 문제로 오해하거나 반복 재시도 |

현재 제출된 Dutch Common 요청은 C1, C2, C3 각 1건이다. 세 요청 모두 pending,
revision 1이며, 저장된 영어 source_release가 현재 영어 Beta와 일치한다.
요청 내용을 읽기 전용으로 복사해 비교한 결과 세 건 모두 병합 충돌 0건이다.
JavaScript 비교 엔진과 SQL 병합 엔진의 결과도 일치한다. 이는 확인 시점의
결과이며, 이후 다른 승인이 이루어지면 다시 비교해야 한다.

## 승인 오류의 발생 경로

1. 10월 5일 item approval 설치에서 `approval_merge:1`을 제공했다.
2. 10월 6일 SAT phase 설치가 같은 capability 함수를 `create or replace`했다.
3. 새 본문은 `blocks:1, sat_phases:1`만 반환하여 승인 표시를 제거했다.
4. 실제 승인 함수나 제출 요청은 삭제되지 않았다.
5. 프런트엔드가 capability 표시만 보고 정상 승인 RPC 호출을 차단했다.

따라서 이 사례는 번역 내용의 충돌, 검토 사유 입력 오류, 계정 이름 문제로
확인된 것이 아니다. 안내대로 오래된 설치 SQL을 무작정 재실행하는 방식은
다른 기능 표시나 검증기를 다시 덮어쓸 위험이 있다.

## 즉시 수정 범위

승인 화면은 읽기 전용 `workspace_prepare_content_approval` RPC를 직접 호출해
실제 준비 상태를 확인한다. 정상 비교 데이터인지 응답을 검증하고, 계정이
바뀌면 결과를 버린다. 서버의 관리자 권한, 요청 revision, 영어 원본 버전,
현재 Beta baseline, 최종 미리보기 검증은 그대로 유지된다. 예전의 전체 챕터
덮어쓰기 승인 방식으로 우회하지 않는다.

과목 연결 오류는 미배포 가능성 및 확인할 함수 이름을 명시한다. 401과 403도
로그인/관리자 권한 문제로 구분한다. 신규 콘텐츠 영역의 제출은 서버 catalog
존재 여부를 먼저 확인하고, 누락 시 초안을 유지하면서 구체적인 영역을 알린다.

## DPAS 변경 세트와 활성화 순서

DPAS를 독립 bachelor `dpas`로 준비하고, 제공받은 과목 정보로
`dpas.dpas-skills`를 준비한다. 이름은 `DPAS - B1 - 1.1 Skills`, 짧은 이름은
`Skills`이다. 약어의 풀네임이나 수업 내용은 추측하지 않는다.

DPAS의 C2/C3는 독립 JSON과 English/Dutch 서버 catalog에서 시작한다.
예시는 빈 입력으로 두고, 다른 전공의 작성 내용을 복제하지 않는다. 새 SQL은
기존 source가 있으면 덮어쓰지 않으며 제출, 승인, 과거 버전도 수정하지 않는다.

**이 변경은 서버와 함께 활성화해야 한다.** registry에 DPAS만 먼저 추가하면
release builder는 DPAS 콘텐츠를 요구하지만 서버 snapshot에는 없어
`incomplete_version`으로 전체 발행을 막을 수 있다. 이 때문에 승인 화면의
수정과 DPAS 활성화는 별도로 배포한다.

준비한 후속 변경은 `fix/workspace-readiness-dpas` 브랜치에 보관한다.

1. `supabase/WORKSPACE_READINESS_SETUP.sql` 적용. capability 복구와 DPAS catalog 생성.
2. 기존에 준비한 `workspace-courses` Edge Function 배포. Verify JWT 켜기.
3. 서버 상태 확인 후 DPAS registry/content 변경 병합 및 Beta 배포.
4. 실제 관리자 계정에서 DPAS 편집·저장·제출 흐름 확인.
5. 학생용 발행 시 DPAS 추가 이후의 새 review version을 생성하여 검토.

현재 `AGENTS.md`는 SQL/Edge Function 적용을 소유자의 Dashboard 작업으로
정하고 있다. 에이전트가 직접 서버에 적용하려면 이 작업에 대한 예외 승인이
필요하다. 설정 파일 준비 또는 로컬 테스트 통과를 서버 활성화 완료로 표시하지 않는다.

## 근본적인 구조 문제

### 1 배포가 세 부분으로 나뉘어 있음

GitHub Pages, Postgres SQL, Edge Functions가 독립적으로 배포된다. GitHub 병합
성공은 서버 준비 완료를 의미하지 않는다. 지금은 이 의존성을 문서와 수동
인계가 연결하고 있어 누락에 취약하다.

대책은 backend 준비 → 계약 검증 → frontend 활성화 순서다. 기능별로 필요한
RPC, 테이블, 함수 slug, 지원 schema를 명시한 계약을 유지하고, 그 검증을
통과하기 전에는 새 기능을 사용 가능으로 표시하지 않아야 한다.

### 2 공용 capability 함수를 여러 설치 파일이 소유함

각 기능이 자신에게 필요한 표시만 써서 마지막 설치가 이전 기능을 지운다.
새 복구 SQL에서는 설치된 구현을 조회하는 한 개의 중앙 capability 정의를
사용한다. 향후 기능별 migration에서 이 함수를 임의로 재정의하지 않도록
전체 migration 순서 테스트가 회귀를 감지해야 한다.

단순 존재 여부는 동작 보증의 전부가 아니다. capability 확인에 더해 실제
권한과 대표 작업의 계약 테스트가 필요하다. 프런트엔드 표시를 제거하는
것만으로 권한 검사를 없애는 방식은 사용하지 않는다.

### 3 과목과 전공의 생성 비용이 다름

기존 전공의 과목은 registry metadata를 추가하면 같은 전공 콘텐츠를 상속한다.
새 전공은 registry, 독립 콘텐츠 JSON, DB scope, 챕터·언어 catalog가 함께
필요하다. 현재 Add course는 후자를 만들 수 없다. 이 구분을 UI에서도
명확히 보여줘야 한다.

단기에는 검증된 새 전공 설정 패키지를 사용한다. 중기에는 관리자용
`Add bachelor` 절차를 만들되 이름 저장만으로 완료하지 않고, 준비·검증·활성화
단계를 관리해야 한다. 장기에는 registry를 DB 중심으로 옮길 수도 있지만,
GitHub를 읽는 module loader와 release builder까지 함께 이전해야 한다.
두 곳에 독립적으로 과목을 선언하는 구조는 피한다.

### 4 기능별 테스트와 전체 조합 테스트의 차이

기존 item approval 테스트는 해당 migration까지 적용했고, SAT 테스트도
자기 설치 결과를 검사했다. 각각 통과해도 두 기능이 최종 상태에서 같이
동작한다는 보장은 없었다. 실제로 SAT 테스트의 기대값 자체에
`approval_merge`가 없었다.

후속 변경에는 전체 migration을 순서대로 적용한 뒤 모든 capability,
Dutch 승인, DPAS 제출·승인, 기존 기록 보존과 권한을 검증하는 테스트를 추가했다.
기존 browser fixture는 API를 모사하므로 실제 배포 여부를 증명하지 못한다.
공개 live check에도 capability와 전공별 언어 catalog 검사를 추가했다.
인증된 최종 사용자 동작은 별도의 실제 계정 확인 항목으로 남긴다.

### 5 콘텐츠 버전과 화면 구조의 식별이 섞여 있음

이전 초안 복구 문제는 HTML 및 loader 버전 변경을 구조 변경과 혼동한 사례였다.
이번 승인 차단은 기능 표시와 실제 구현을 혼동한 사례다. 모두 서로 다른
종류의 버전을 하나의 신호로 판단하는 문제가 있다.

구분해야 하는 것은 콘텐츠 revision, stable item ID, schema version,
렌더러 버전, 배포 버전이다. 장기적으로 위치 기반 `block-N`이나 ID 없는
배열에만 의존하면 삽입·재정렬 후 대응 관계를 확실히 알 수 없다.
고정 item ID와 명시적인 schema migration으로 옮기는 것이 적절하다.
현재는 불확실한 대응을 자동 추정하지 않고 원본 백업과 선택형 복구를 유지한다.

### 6 과거 review와 현재 registry의 의존성

발행 코드가 현재 registry와 저장된 review snapshot을 함께 사용한다.
전공이 추가되면 과거 review에 그 전공이 없어 발행이 거부될 수 있다.
기존 학생 release 파일 자체는 변경되지 않는다.

단기 해결은 새 전공 활성화 후 새 review version을 만들고 검토하는 것이다.
중기에는 review 생성 시 registry 및 schema manifest도 함께 고정하여,
나중에 바뀐 목록이 과거 review를 소급 변경하지 않게 해야 한다.
과거 snapshot에 새 콘텐츠를 몰래 채워 넣어 통과시키는 방식은 사용하지 않는다.

## 권고 우선순위

| 순서 | 조치 | 목적 |
| --- | --- | --- |
| 지금 | 승인 hotfix, capability 복구, 함수 배포, DPAS 일괄 활성화 | 현재 업무 차단 해소 |
| 다음 | 전체 migration 테스트와 live readiness를 배포 필수 단계로 연결 | 미설치·덮어쓰기 회귀 방지 |
| 다음 | 관리자 설정 상태 화면과 단계별 오류 코드 | 사용자가 원인을 추측하지 않게 함 |
| 중기 | Add bachelor 절차와 review manifest 고정 | 새 전공 확장 및 과거 버전 재현성 확보 |
| 중기 | stable content IDs와 명시적 schema migration | 구조 변경 시 안전한 세부 비교 |
| 별도 결정 | GitHub registry 유지 또는 DB 중심 콘텐츠 관리 | 운영 규모에 따른 구조 단순화 |

Firebase로 교체해야 해결되는 유형의 문제라는 증거는 없다. 현재 원인은 제품
선택보다 배포 순서, 기능 계약, 데이터 모델과 검증 범위에 있다. 같은 운영
방식이면 다른 백엔드에서도 유사한 문제가 반복될 수 있다.

## 검증의 한계와 보존

실제 Dutch 요청의 내용·상태·revision을 수정하지 않는다. 로컬 복제 승인
테스트와 실제 관리자 승인 행위를 구분한다. 실제 계정에서 버튼을 눌러
승인한 뒤 Beta 반영과 배포 성공까지 확인해야 해당 요청의 완료로 기록한다.
DPAS의 실제 학습 콘텐츠 작성과 학생용 Publish는 이번 기반 설정과 별도다.
