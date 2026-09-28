import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Triagem | Grupo J.Macedo",
  description: "Sistema de Triagem - Grupo J.Macedo Eletrônica",
  icons: { icon: "/favicon.png" },
};

// Aplica o tema (azul ou claro) e a cor escolhida ANTES da página
// aparecer, pra não dar aquela "piscada" de cor ao abrir.
const SCRIPT_TEMA = `
try {
  if (localStorage.getItem('triagem-tema') === 'light') {
    document.documentElement.classList.add('light');
  }
  if (localStorage.getItem('triagem-cor-padrao') === '0') {
    var a = localStorage.getItem('triagem-cor-accent');
    var b = localStorage.getItem('triagem-cor-accent2');
    if (a && b) {
      var s = document.documentElement.style;
      s.setProperty('--accent', a);
      s.setProperty('--accent2', b);
      var n = parseInt(b.replace('#', ''), 16);
      s.setProperty('--accent-glow', 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',0.28)');
    }
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,800;1,900&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
