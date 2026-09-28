import LoginForm from "@/components/LoginForm";

// Mesmo degradê azul do logo, espalhado pela tela toda (igual ao Allied).
const FUNDO_DEGRADE =
  "radial-gradient(140% 120% at 90% 8%, #234270 0%, #0e2040 32%, #050f1f 68%, #040c19 100%)";

export default function LoginPage() {
  return (
    <main
      className="login-escuro min-h-screen w-full grid grid-cols-1 md:grid-cols-[7fr_3fr] md:h-screen md:overflow-hidden"
      style={{ background: FUNDO_DEGRADE }}
    >
      {/* Lado esquerdo: logo em destaque, fundindo com o fundo */}
      <div className="relative flex items-center justify-center px-6 pt-8 md:py-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-triagem.jpg"
          alt="Triagem - Grupo J.Macedo Eletrônica"
          className="w-full max-w-[780px] h-auto"
          style={{
            WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)",
            maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)",
          }}
        />
      </div>

      {/* Lado direito: formulário */}
      <div className="relative flex items-center px-6 md:px-10 py-8">
        <div className="relative w-full max-w-md mx-auto md:mx-0">
          <h1 className="text-2xl font-semibold text-white mb-1.5">Entrar</h1>
          <p className="text-sm text-tri-silver/60 mb-8">
            Use seu login no padrão <span className="text-tri-silver/90">nome.sobrenome</span>
          </p>

          <LoginForm />

          <p className="text-left text-[11px] text-tri-silver/40 mt-8">
            Acesso restrito. Em caso de dúvidas, procure o administrador do sistema.
          </p>
        </div>
      </div>
    </main>
  );
}
