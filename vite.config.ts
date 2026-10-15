import { defineConfig } from 'vite';

// 프로젝트가 Windows 드라이브(/mnt/d)에 있어 WSL에서 파일 변경 감지가 안 되므로 폴링으로 감시한다.
export default defineConfig({
  server: {
    watch: { usePolling: true, interval: 300 },
  },
});
