import "./globals.css";

export const metadata = {
  title: "Abydos Calculator",
  description: "상급 아비도스 융화 재료 계산기",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}