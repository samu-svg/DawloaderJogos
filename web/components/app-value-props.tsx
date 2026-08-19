const PROPS = [
  {
    accent: "text-violet-300",
    ring: "border-violet-500/30 bg-violet-500/10",
    title: "Monta o HD sozinho",
    text: "Escolha os jogos e confirme. O app cria as pastas, descompacta e coloca cada arquivo no lugar certo — Games, Content, o que estiver no manifesto.",
  },
  {
    accent: "text-cyan-300",
    ring: "border-cyan-500/30 bg-cyan-500/10",
    title: "Download automático",
    text: "Fila de downloads com verificação de integridade e retomada de onde parou. Você não renomeia, não move e não extrai nada à mão.",
  },
  {
    accent: "text-pink-300",
    ring: "border-pink-500/30 bg-pink-500/10",
    title: "Zero anúncios",
    text: "Sem pop-up, sem encurtador, sem espera. A assinatura do app paga a infraestrutura — a experiência é limpa do início ao fim.",
  },
  {
    accent: "text-emerald-300",
    ring: "border-emerald-500/30 bg-emerald-500/10",
    title: "Acervo incluído",
    text: "Assinando o app você acessa o acervo inteiro, sem comprar jogo por jogo. Novos títulos entram no mesmo plano.",
  },
];

export function AppValueProps() {
  return (
    <section className="mt-16">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROPS.map((item) => (
          <article
            key={item.title}
            className={`card-glow rounded-2xl border p-6 text-center ${item.ring}`}
          >
            <h3 className={`text-base font-semibold ${item.accent}`}>
              {item.title}
            </h3>
            <p className="mt-2.5 text-sm leading-6 text-zinc-400">
              {item.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
