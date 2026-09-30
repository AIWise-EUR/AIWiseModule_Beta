# Workspace 팀 관리 적용

이 변경은 기존 관리자를 유지합니다. 가입·로그인·이메일 확인 절차는 그대로이며, 기존 일반 멤버의 권한을 Beta 검토로 제한합니다. 팀 관리 RPC는 GitHub 연결 확인용 Edge Function과 별개입니다. 새 Edge Function이나 Secret은 필요 없습니다.

## 권한

| 작업 | 일반 멤버 | 관리자 |
| --- | --- | --- |
| Workspace의 Beta 미리보기 | 가능 | 가능 |
| 댓글·답글·하이라이트·박스·핀 피드백 | 가능 | 가능 |
| 피드백 해결·다시 열기 | 불가 | 가능 |
| Studio 편집·제출, Control Tower 검토·승인 | 불가 | 가능 |
| 가입 신청 승인·역할 변경·접근 중지 | 불가 | 가능 |

미승인·접근 중지 계정은 Workspace에서 계정 화면만 사용할 수 있습니다. 관리자에게는 기존 캠퍼스 지도와 탐색을 유지하고, 사이드바에 **Team management**가 추가됩니다. 일반 멤버에게는 Beta와 계정 메뉴만 표시하며, 관리자 주소를 직접 입력해도 Beta 시작 화면으로 돌아갑니다.

## 적용 순서

1. Supabase 프로젝트의 SQL Editor에서 [팀 권한 SQL](migrations/20260930171519_workspace_team_access.sql) 전체를 실행합니다. 기존 언어별 콘텐츠 migration까지 적용된 프로젝트용입니다.
2. 완료 후 알려주세요. SQL이 적용됐는지 읽기 전용으로 확인한 다음 Workspace 변경을 배포합니다.
3. 배포 후 Workspace에 기존 관리자 계정으로 로그인하고 **Team management**를 엽니다.
4. 이름이나 이메일로 사람을 찾고 **Review access / Manage access**를 누릅니다.
5. Role은 **Member / Administrator**, Workspace access는 **Active / Paused**로 선택한 뒤 **Save access**를 누릅니다.

가입한 계정만 목록에 나타납니다. 계정 생성이나 초대 이메일 전송 기능은 추가하지 않습니다. 이메일 미확인 계정은 목록에 표시되지만 활성화할 수 없습니다. 일반 멤버는 이름·이메일을 포함한 팀 목록을 조회할 수 없습니다.

본인도 다른 관리자가 있으면 일반 멤버로 바꿀 수 있습니다. **마지막 활성 관리자 한 명은 해제하거나 중지할 수 없습니다.** 역할 변경은 데이터베이스에서 순서대로 처리되며, 오래된 화면에서 다른 관리자의 변경을 덮어쓰려고 하면 새로고침을 안내합니다. 변경한 관리자·대상·이전/이후 권한은 비공개 감사 테이블에 기록됩니다.

## 적용 범위

- 데이터베이스는 멤버의 Studio 제출과 승인, 요청 목록 조회, 피드백 해결, 팀 관리 호출을 차단합니다. 화면에서 버튼만 숨기는 방식이 아닙니다.
- 기존 관리자와 기존 콘텐츠·피드백·초안은 삭제하거나 자동 변경하지 않습니다.
- 사용자 메타데이터의 `role`은 사용하지 않습니다. 현재 `workspace_members`의 활성 역할이 기준입니다.
- 접근 중지는 다음 API 요청부터 적용됩니다. 화면은 계정 창을 다시 열거나 탭으로 돌아올 때 권한을 다시 확인합니다. 로그인 자체나 Supabase 대시보드 권한을 변경하지 않습니다.
- GitHub Pages에 이미 올라간 정적 파일과 승인된 모듈 콘텐츠는 계속 공개됩니다. 이 변경은 Workspace 화면과 서버 작업 권한을 제한하며, 정적 사이트 전체를 비공개 호스팅으로 바꾸지 않습니다. 독립적인 공개 교사용 Course Profiler와 Published 사이트도 유지합니다.
- 브라우저에 저장되는 기존 로컬 초안은 계정별 비공개 서버 저장소가 아닙니다.
- GitHub 자동 커밋, Beta 버전 선택, 배포 자동화는 이번 변경에 포함되지 않습니다.

## 검증

실제 계정의 권한을 바꾸지 않고 임시 데이터베이스와 가상 계정 브라우저 화면으로 검증했습니다.

```sh
node supabase/tests/team_access.cjs
node --test workspace/tests/team-access.test.cjs
```

테스트 의존성: `@electric-sql/pglite@0.3.14`, `linkedom@0.18.12`. 기존 테스트와 동일하게 `PGLITE_MODULE`, `LINKEDOM_MODULE`로 별도 설치 경로를 지정할 수 있습니다.

운영 SQL 적용, 실제 계정 두 개로의 승인·권한 변경 검증, 운영 Workspace 배포는 별도 확인이 필요합니다. 관리자 계정은 테스트 목적으로 승격하거나 강등하지 않았습니다.

운영 보안 진단에서는 기존 `workspace_role()`의 [SECURITY DEFINER 실행 권한 안내](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)와 [유출 비밀번호 차단 미설정](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)이 확인됐습니다. 이번 변경에서 해당 운영 설정은 바꾸지 않았습니다.
