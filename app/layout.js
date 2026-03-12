import "./globals.css";

export const metadata = {
  title: "PMTM MVP",
  description: "비트를 분석하고 랩 가사 초안을 만드는 프메더머니 웹 MVP"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
