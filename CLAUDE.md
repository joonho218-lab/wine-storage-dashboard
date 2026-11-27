서울석유 와인창고 대시보드 — Claude Code 작업 안내

https://wine-storage-dashboard.vercel.app/

 — 서울석유 와인 재고(2층 와인창고 · 4층 식당 셀러 · 삼도빌딩)를 팀이 함께 관리하는 웹 대시보드.

사용자와 일하는 방식
- 주인: 최준호(관리자). 개발자가 아니에요. 설명은 쉬운 한국어(해요체)로, 전문 용어는 풀어서.
- 명령어를 알려 줄 때는 VS Code 터미널(Windows PowerShell)에 그대로 붙여넣을 수 있게 한 줄씩.
- 화면 문구도 해요체, 짧게. 코드 주석은 한국어.
- 비밀값(API 키, service_role 키, 비밀번호)은 절대 코드·커밋·대화에 넣지 않아요. Supabase 비밀값/대시보드에서만.
- 변경은 브랜치 → PR로 올리고, 병합은 사용자가 해요 (사용자가 직접 main에 올려 달라고 할 때만 예외).

구성
- 화면: React 19 + Vite + Tailwind 3.4 (src/), 아이콘 lucide-react. GitHub main에 병합되면 Vercel이 자동 배포.
- 서버: Supabase 프로젝트 rufmaqaxrwadlbzgoykb (Auth · DB · Realtime · Edge Functions)
    - 주소/공개키: src/supabase.js
    - 테이블: wines(재고), wine_logs(이력), team_members(팀 계정 · role admin/member), wine_check_acks(점검 확인)
    - 모든 wines 쓰기는 트리거 wine_private.audit_wine가 로그인한 팀원 이름으로 이력을 남겨요. 
    - 로그인 없이(service_role/SQL 편집기) 쓰면 트리거가 막아요 — 데이터 수정은 화면에서, 팀 계정으로.
    - RPC: change_wine_quantity, undo_wine_change
    - Edge Functions (supabase/functions/):
        - wine-team-account — 팀원 추가/삭제/비번 재설정 (관리자)
        - wine-label-scan — 라벨·목록 사진 인식 (Claude API, 비밀값 ANTHROPIC_API_KEY, 모델 claude-sonnet-5-5)
    - DB 변경 SQL은 database/에 파일로 두고, 사용자가 Supabase SQL 편집기에서 실행해요.

주요 동작 (어디를 보면 되는지)
- src/App.jsx — 거의 모든 화면·상태. 큼(2,400줄+). 고칠 때 관련 부분만 찾아서.
- 보관 장소 탭: DB 칸 없이 보관위치(rack) 값으로 구분 — src/lib/wine.js의 FLOORS, floorOf()
    - 4층… → 4층 식당 셀러, 삼도빌딩 / 삼도빌딩 … → 삼도빌딩, 나머지(기존 삼도빌딩박스 포함) → 2층
    - 엑셀 올리기(동기화)는 지금 탭 와인끼리만, 초기화는 2층만 — 다른 장소 데이터를 지우지 않게 꼭 유지
- 검색: src/lib/search.js — 표기 변형(샤또/샤토, 된소리·모음, 악센트)과 근사 일치
- 와인 종류 추정: src/lib/wineType.js (이름 규칙)
- 점검 필요: src/lib/checks.js + src/components/CheckPanel.jsx
- 여러 와인 한 번에 등록: src/components/BulkAdd.jsx (탭// 구분 붙여넣기)
- 사진 등록: src/lib/labelScan.js → wine-label-scan 함수 (최대 10장, 앞면·뒷면 묶기)
- 엑셀 다운로드: src/lib/exportExcel.js (ExcelJS를 CDN에서 불러와 스타일 적용, 실패하면 기본 엑셀)
    - '와인재고현황' 시트 앞 11칸은 '새 엑셀 올리기'가 읽는 형식이라 순서·이름을 바꾸면 안 돼요.
- 병 사진(정적 파일): public/wines/

명령어
npm install
npm run dev      # http://localhost:5173 (실제 Supabase에 붙어요 — 팀 계정으로 로그인)
npm run build    # 올리기 전에 꼭 통과 확인
- 로컬에서도 실제 데이터라 시험 삼아 등록/삭제하지 않기. 필요하면 화면에서 등록 후 같은 화면에서 되돌리기.

주의
- lucide-react 아이콘은 이미 쓰는 것 위주로 (없는 이름이면 빌드는 되는데 화면이 깨져요).
- Tailwind 3 — grid-cols-14 같은 없는 클래스는 grid-cols-[repeat(14,minmax(0,1fr))]처럼.
- 저장소가 공개(public) 예요. 재고 데이터·키를 저장소 파일로 넣지 않기.
