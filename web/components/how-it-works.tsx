const STEPS = [
  {
    step: "01",
    title: "Pague o software",
    text: "O pagamento é pelo app MontaHD — não pelos jogos. A assinatura mensal libera o software e o acervo inteiro enquanto estiver ativa.",
  },
  {
    step: "02",
    title: "Marque os jogos",
    text: "No site, marque os títulos do acervo e clique em Instalar no HD. No app, escolha a pasta onde gravar.",
  },
  {
    step: "03",
    title: "O HD se monta",
    text: "Download, verificação e extração automáticos. Cada jogo na pasta correta.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mt-20 scroll-mt-24">
      <h2 className="section-heading">Como funciona</h2>
      <ol className="mt-7 grid gap-4 sm:grid-cols-3">
        {STEPS.map((item) => (
          <li
            key={item.step}
            className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 text-center"
          >
            <span className="absolute -right-1 -top-5 text-7xl font-bold text-white/5">
              {item.step}
            </span>
            <h3 className="relative text-base font-semibold text-white">
              {item.title}
            </h3>
            <p className="relative mt-2 text-sm leading-6 text-zinc-400">
              {item.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
