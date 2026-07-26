# Camera KakaoMap ChatGPT App

기존 `camera-kakaomap-gpt` 데이터·조회 로직을 웹 ChatGPT에서 사용할 수 있도록 MCP 앱으로 노출하는 최소 구현입니다.

## 제공 도구

- `lookup_camera`: 전체 관리번호 또는 끝 4자리로 위치를 조회합니다.
- `prepare_trip_manifest`: 일정표에서 사용자가 선택한 날짜·행을 받아 `YYMMDD` 폴더별 저장안, `순번. 코드 지점명` 이름, 주소 일치 상태, KakaoMap 링크를 만듭니다.

이 앱은 사용자의 KakaoMap 계정이나 Chrome 세션에 접근하지 않습니다. 따라서 즐겨찾기 폴더 생성·저장은 자동 실행하지 않고, 검토 가능한 링크와 누락·제외 목록만 반환합니다. `K...` 인수/인수검사 행은 기본 제외되며, 명시적으로 포함해도 KakaoMap 주소 확인 후 `manualLatitude`·`manualLongitude`를 함께 전달한 경우에만 수동 링크를 만듭니다. 실제 자동 저장이 필요하면 사용자의 PC에서 실행되는 별도 Chrome 브리지와 명시적 승인 단계가 추가로 필요합니다.

## 로컬 실행

저장소 루트에서 실행합니다.

```powershell
cd C:\Users\User\Workspaces\apps\camera-kakaomap-gpt\chatgpt-app
npm install
npm run check
npm start
```

기본 MCP 주소는 `http://localhost:8787/mcp`입니다. 데이터 파일은 기본적으로 저장소의 `data/cameras.json`을 읽습니다. 다른 위치를 쓰려면 `CAMERA_DATA_PATH`를 설정하세요.

## 웹 ChatGPT 연결

1. 로컬 서버를 실행합니다.
2. `ngrok http 8787` 등으로 로컬 서버를 HTTPS로 노출합니다.
3. ChatGPT의 Developer Mode에서 새 앱을 만들고 `https://<터널-주소>/mcp`를 입력합니다.
4. 새 대화에서 앱을 추가한 뒤, 일정표 이미지와 함께 “선택된 행만 읽어 저장안 만들어줘”라고 요청합니다.

일정표 이미지에서 날짜·코드·주소를 모델이 먼저 추출하도록 하고, 인접 행은 자동으로 포함하지 않도록 요청하는 것이 안전합니다. `K...` 인수/인수검사 행은 명시적으로 포함한다고 말한 경우에만 처리됩니다.

## 배포 전 주의

- 공개 HTTPS 호스팅에서는 `data/cameras.json`을 포함하거나 별도의 서버측 데이터 저장소를 구성해야 합니다.
- 현재 도구는 읽기 전용이며 KakaoMap의 즐겨찾기 상태를 변경하지 않습니다.
- 실제 공개 배포 전에는 인증, 개인정보 처리방침, 주소 일치 검증, 테스트 프롬프트를 별도로 점검해야 합니다.
