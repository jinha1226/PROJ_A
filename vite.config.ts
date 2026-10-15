import { defineConfig } from 'vite';

// 프로젝트가 Windows 드라이브(/mnt/d)에 있어 WSL에서 파일 변경 감지가 안 되므로 폴링으로 감시한다.
// GitHub Pages는 /저장소이름/ 아래에서 열리므로 배포 빌드만 그 경로를 쓴다 (.github/workflows/pages.yml)
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
  server: {
    watch: { usePolling: true, interval: 300 },
  },
});
