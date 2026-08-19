const STEPS = [
  {
    step: "01",
    title: "Assine o app",
    text: "Um plano mensal libera o MontaHD e o acervo inteiro. Cartão ou PIX.",
  },
  {
    step: "02",
    title: "Marque os jogos",
    text: "No app, escolha os títulos do acervo e aponte a pasta raiz do seu HD.",
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
      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Como funciona
      </h2>
      <ol className="mt-7 grid gap-4 sm:grid-cols-3">
        {STEPS.map((item) => (
          <li
            key={item.step}
            className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6"
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
