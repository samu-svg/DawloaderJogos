const STEPS = [
  {
    step: "01",
    title: "Libere o app",
    text: "Escolha 1, 2 ou 3 meses. Cartão renovável ou PIX à vista — você paga pelo software, não pelos arquivos.",
  },
  {
    step: "02",
    title: "Marque os jogos",
    text: "No site, selecione os títulos e clique em Instalar no HD. No app, escolha a pasta raiz onde gravar.",
  },
  {
    step: "03",
    title: "O HD se monta",
    text: "O MontaHD baixa, confere a integridade, descompacta e organiza cada jogo na pasta correta.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Como funciona
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Três passos. O resto o app faz sozinho.
        </p>
      </div>
      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((item) => (
          <li
            key={item.step}
            className="relative overflow-hidden rounded-[28px] border border-border/80 bg-surface/80 p-6"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-2">
              {item.step}
            </span>
            <h3 className="mt-3 text-base font-semibold text-white">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{item.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
