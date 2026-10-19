/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 와인 셀러 톤: 기존 slate(푸른 회색)를 붉은 기가 도는 따뜻한 회색으로 교체
      colors: {
        slate: {
          50: '#f7f4f3',
          100: '#f3eeeb',
          200: '#e3dbdd',
          300: '#cfc6c9',
          400: '#9b9095',
          500: '#6d6368',
          600: '#554b51',
          650: '#463d43',
          700: '#3b3139',
          750: '#30282f',
          800: '#2a2329',
          850: '#221c22',
          900: '#19151a',
          950: '#0f0d10',
        },
        wine: {
          DEFAULT: '#c0364f',
          dark: '#8f2338',
          light: '#f29aaa',
        },
        gold: {
          DEFAULT: '#e4b45f',
          dark: '#2a1d07',
        },
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'ui-sans-serif', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
