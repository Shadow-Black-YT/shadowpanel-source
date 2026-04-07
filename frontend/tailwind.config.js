export default {
  content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base:'#020209', surface:'#06060f', card:'#0a0a18', elevated:'#0e0e22',
        border: { DEFAULT:'rgba(0,212,255,0.1)', hover:'rgba(0,212,255,0.25)', active:'rgba(0,212,255,0.5)' },
        cyan: { DEFAULT:'#00d4ff', dim:'#00a8cc' },
        violet: { DEFAULT:'#7928ca', light:'#a855f7' },
        neon: { green:'#00ff88', red:'#ff2d55', amber:'#ff9500', blue:'#0080ff' },
        text: { primary:'#e8e8ff', secondary:'#8888aa', muted:'#4a4a6a' },
      },
      fontFamily: {
        display: ['Syne','sans-serif'],
        sans:    ['DM Sans','system-ui','sans-serif'],
        mono:    ['Geist Mono','JetBrains Mono','monospace'],
      },
      animation: {
        'glow': 'glowPulse 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        'fade-in': 'fadeIn 0.25s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'ping-slow': 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        'scan': 'scan 8s linear infinite',
        'counter': 'counter 0.6s ease-out',
      },
      keyframes: {
        glowPulse: { from:{boxShadow:'0 0 8px rgba(0,212,255,0.2)'}, to:{boxShadow:'0 0 30px rgba(0,212,255,0.55),0 0 60px rgba(0,212,255,0.2)'} },
        float: { '0%,100%':{transform:'translateY(0px)'}, '50%':{transform:'translateY(-10px)'} },
        slideUp: { from:{opacity:'0',transform:'translateY(16px)'}, to:{opacity:'1',transform:'translateY(0)'} },
        fadeIn: { from:{opacity:'0'}, to:{opacity:'1'} },
        scan: { '0%':{transform:'translateY(-100%)'}, '100%':{transform:'translateY(100vh)'} },
        counter: { from:{opacity:'0',transform:'scale(0.8)'}, to:{opacity:'1',transform:'scale(1)'} },
      },
      boxShadow: {
        'glow-cyan':  '0 0 20px rgba(0,212,255,0.35),0 0 60px rgba(0,212,255,0.1)',
        'glow-violet':'0 0 20px rgba(121,40,202,0.4),0 0 60px rgba(121,40,202,0.15)',
        'glow-green': '0 0 20px rgba(0,255,136,0.35)',
        'glow-red':   '0 0 20px rgba(255,45,85,0.35)',
        'card':       '0 4px 32px rgba(0,0,0,0.6),0 1px 0 rgba(0,212,255,0.05)',
        'card-hover': '0 8px 48px rgba(0,0,0,0.7),0 0 24px rgba(0,212,255,0.15),0 1px 0 rgba(0,212,255,0.1)',
      },
      backdropBlur: { DEFAULT: '16px' },
    },
  },
  plugins: [],
}
